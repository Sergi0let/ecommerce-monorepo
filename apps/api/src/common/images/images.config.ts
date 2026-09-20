import { ConfigService } from '@nestjs/config';
import {
  ImageProcessingConfigSchema,
  type ImageProcessingConfigType,
} from '@repo/contracts';

export const IMAGE_PROCESSING_CONFIG = Symbol('IMAGE_PROCESSING_CONFIG');

export function loadImageProcessingConfig(
  config: ConfigService,
): ImageProcessingConfigType {
  const result = ImageProcessingConfigSchema.safeParse({
    IMAGE_MAX_FILE_SIZE_BYTES: config.get<unknown>('IMAGE_MAX_FILE_SIZE_BYTES'),
    IMAGE_MAX_INPUT_PIXELS: config.get<unknown>('IMAGE_MAX_INPUT_PIXELS'),
    IMAGE_PROCESSING_CONCURRENCY: config.get<unknown>(
      'IMAGE_PROCESSING_CONCURRENCY',
    ),
  });

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(
      `Invalid image processing configuration: ${fields.join(', ')}`,
    );
  }

  return result.data;
}
