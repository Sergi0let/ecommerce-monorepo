import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessor: ImageProcessorService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async create(productId: string, data: CreateProductImagesDto, file: Buffer) {
    const variantId = data.variantId ?? null;
    await this.assertOwnerExists(productId, variantId);

    const derivatives = await this.imageProcessor.process(file);
    const imageId = randomUUID();
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
      await this.cleanupUpload(Object.values(keys), productId, imageId);
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
    this.logger.log(`Deleting product image ${id}`);

    await this.getById(id);

    return this.prisma.client.productImage.delete({ where: { id } });
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
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
  }

  private async cleanupUpload(
    keys: string[],
    productId: string,
    imageId: string,
  ) {
    const results = await Promise.allSettled(
      keys.map(async (key) => this.storage.deleteObject(key)),
    );
    const failedKeys = keys.filter(
      (_, index) => results[index]?.status === 'rejected',
    );
    if (failedKeys.length > 0) {
      this.logger.error({
        message:
          'Product image upload compensation incomplete; storage cleanup required',
        productId,
        imageId,
        keys: failedKeys,
      });
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
