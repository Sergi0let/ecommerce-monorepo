import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import { IMAGE_UPLOAD_COMMIT_WINDOW_MS } from '@repo/contracts';
import type { Prisma } from '@repo/database';
import { randomUUID } from 'node:crypto';
import { ImageProcessorService } from '../../common/images/image-processor.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../common/storage/object-storage.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { UpdateProductImagesDto } from './dto/update-product-images.dto';
import { ImageCleanupService } from './image-cleanup.service';
import { lockImageProduct } from './image-storage.utils';

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly cleanup: ImageCleanupService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async create(productId: string, data: CreateProductImagesDto, file: Buffer) {
    const variantId = data.variantId ?? null;
    await this.assertOwnerExists(productId, variantId);

    const derivatives = await this.imageProcessor.process(file);
    const imageId = randomUUID();
    const commitDeadline = Date.now() + IMAGE_UPLOAD_COMMIT_WINDOW_MS;
    const storageKeyBase = `products/${productId}/${imageId}`;
    const keys = {
      thumbnail: `${storageKeyBase}/thumbnail.webp`,
      medium: `${storageKeyBase}/medium.webp`,
      large: `${storageKeyBase}/large.webp`,
    };

    try {
      // Sequential uploads cannot complete late after compensation has started.
      for (const name of ['thumbnail', 'medium', 'large'] as const) {
        await this.storage.putObject({
          key: keys[name],
          body: derivatives[name].buffer,
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        });
      }

      const image = await this.prisma.client.$transaction(
        async (transaction) => {
          await this.lockProduct(transaction, productId);
          if (Date.now() > commitDeadline)
            throw new RequestTimeoutException(
              'Image upload expired; upload the file again',
            );
          // The product/variant may have been deleted while Sharp/R2 was running.
          await this.assertOwnerExists(productId, variantId, transaction);
          if (data.isPrimary) {
            await transaction.productImage.updateMany({
              where: { productId, variantId, isPrimary: true },
              data: { isPrimary: false },
            });
          }
          return transaction.productImage.create({
            data: {
              id: imageId,
              productId,
              variantId,
              storageKeyBase,
              thumbnailUrl: this.storage.getPublicUrl(keys.thumbnail),
              mediumUrl: this.storage.getPublicUrl(keys.medium),
              largeUrl: this.storage.getPublicUrl(keys.large),
              width: derivatives.large.width,
              height: derivatives.large.height,
              alt: data.alt,
              sortOrder: data.sortOrder,
              isPrimary: data.isPrimary,
            },
          });
        },
        { isolationLevel: 'ReadCommitted' },
      );

      this.logger.log({
        message: 'Product image uploaded',
        productId,
        imageId,
      });
      return image;
    } catch (error) {
      // Include failed/unacknowledged PUTs: storage may have accepted their bytes.
      await this.cleanupUpload(
        Object.values(keys),
        productId,
        imageId,
        variantId,
      );
      throw error;
    }
  }

  async updateById(id: string, data: UpdateProductImagesDto) {
    const image = await this.getById(id);

    return this.prisma.client.$transaction(
      async (transaction) => {
        await this.lockProduct(transaction, image.productId);
        const current = await transaction.productImage.findUnique({
          where: { id },
        });
        if (!current) {
          throw new NotFoundException(`Product image with ID ${id} not found`);
        }
        if (data.isPrimary === true) {
          await transaction.productImage.updateMany({
            where: {
              id: { not: id },
              productId: current.productId,
              variantId: current.variantId,
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
        }

        return transaction.productImage.update({
          where: { id },
          data: {
            alt: data.alt,
            sortOrder: data.sortOrder,
            isPrimary: data.isPrimary,
          },
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  async delete(id: string) {
    await this.cleanup.deleteImage(id);
  }

  getAll() {
    return this.prisma.client.productImage.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const image = await this.prisma.client.productImage.findUnique({
      where: { id },
    });

    if (!image) {
      throw new NotFoundException(`Product image with ID ${id} not found`);
    }

    return image;
  }

  private async lockProduct(
    transaction: Prisma.TransactionClient,
    productId: string,
  ) {
    // All image creates/updates take the same lock, including an empty gallery.
    // READ COMMITTED gives subsequent queries a fresh snapshot after waiting.
    const rows = await lockImageProduct(transaction, productId);
    if (rows.length === 0) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
  }

  private async cleanupUpload(
    keys: string[],
    productId: string,
    imageId: string,
    variantId: string | null,
  ) {
    try {
      // A failed transaction acknowledgement may still mean it committed.
      const queued = await this.prisma.client.$transaction(
        async (transaction) => {
          // Wait for any uncertain upload commit to release its product lock.
          await lockImageProduct(transaction, productId);
          if (
            await transaction.productImage.findUnique({
              where: { id: imageId },
            })
          )
            return false;
          await transaction.imageCleanupTask.createMany({
            data: keys.map((key) => ({ key, productId, imageId, variantId })),
            skipDuplicates: true,
          });
          return true;
        },
        { isolationLevel: 'ReadCommitted' },
      );
      if (!queued) return;
      const failed = await this.cleanup.drain({ imageId }, false);
      if (failed) {
        const pending = await this.prisma.client.imageCleanupTask.findMany({
          where: { imageId },
          select: { key: true },
        });
        this.logger.error({
          message: 'Upload cleanup pending retry',
          productId,
          imageId,
          keys: pending.map(({ key }) => key),
        });
      }
      return;
    } catch {
      // If the DB is unavailable, preserve objects: the commit outcome is unknown.
      // Recovery will inspect aged objects against DB references later.
      this.logger.error({
        message: 'Upload cleanup deferred; recovery required',
        productId,
        imageId,
        keys,
      });
      return;
    }
  }

  private async assertOwnerExists(
    productId: string,
    variantId: string | null,
    client: Prisma.TransactionClient = this.prisma.client,
  ) {
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (variantId === null) {
      return;
    }

    const variant = await client.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException(
        `Variant ${variantId} does not belong to product ${productId}`,
      );
    }
  }
}
