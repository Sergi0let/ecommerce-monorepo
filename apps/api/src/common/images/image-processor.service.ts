import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ImageInputMetadataSchema,
  type ImageProcessingConfigType,
} from '@repo/contracts';
import sharp, { type Sharp } from 'sharp';
import {
  IMAGE_PROFILES,
  IMAGE_WEBP_QUALITY,
  type ImageDerivative,
  type ProcessedImage,
} from './image-profiles';
import { IMAGE_PROCESSING_CONFIG } from './images.config';
import { isAnimatedPng } from './png-animation';

@Injectable()
export class ImageProcessorService {
  private activeJobs = 0;

  constructor(
    @Inject(IMAGE_PROCESSING_CONFIG)
    private readonly config: ImageProcessingConfigType,
  ) {}

  async process(input: Buffer): Promise<ProcessedImage> {
    if (!Buffer.isBuffer(input) || input.length === 0) {
      throw new BadRequestException('Image file is empty or invalid');
    }
    if (input.length > this.config.IMAGE_MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException('Image exceeds the file size limit');
    }
    if (this.activeJobs >= this.config.IMAGE_PROCESSING_CONCURRENCY) {
      throw new ServiceUnavailableException(
        'Image processor is busy. Try again later',
      );
    }

    this.activeJobs++;
    let source: Sharp | undefined;
    try {
      if (isAnimatedPng(input)) {
        throw new BadRequestException('Animated images are not supported');
      }
      source = sharp(input, {
        limitInputPixels: this.config.IMAGE_MAX_INPUT_PIXELS,
        failOn: 'warning',
      });
      const metadata = await source.metadata();
      const result = ImageInputMetadataSchema.safeParse({
        ...metadata,
        animated: metadata.loop !== undefined || metadata.delay !== undefined,
      });
      if (!result.success) {
        throw new BadRequestException(
          'Expected a static JPEG, PNG or WebP image',
        );
      }
      if (
        result.data.width * result.data.height >
        this.config.IMAGE_MAX_INPUT_PIXELS
      ) {
        throw new PayloadTooLargeException('Image exceeds the pixel limit');
      }

      // Sequential derivatives keep each admitted job to one decoding pipeline.
      return {
        thumbnail: await this.render(source, IMAGE_PROFILES.thumbnail),
        medium: await this.render(source, IMAGE_PROFILES.medium),
        large: await this.render(source, IMAGE_PROFILES.large),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'Image is corrupted, unsupported or exceeds the pixel limit',
      );
    } finally {
      source?.destroy();
      this.activeJobs--;
    }
  }

  private async render(source: Sharp, size: number): Promise<ImageDerivative> {
    const pipeline = source.clone();
    try {
      const { data, info } = await pipeline
        .rotate()
        .resize({
          width: size,
          height: size,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: IMAGE_WEBP_QUALITY })
        .timeout({ seconds: 15 })
        .toBuffer({ resolveWithObject: true });
      return { buffer: data, width: info.width, height: info.height };
    } finally {
      pipeline.destroy();
    }
  }
}
