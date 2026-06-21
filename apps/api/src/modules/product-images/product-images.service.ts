import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { UpdateProductImagesDto } from './dto/update-product-images.dto';

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductImagesDto) {
    const variantId = data.variantId ?? null;
    this.logger.log(
      `Creating image for product ${data.productId}${variantId ? ` and variant ${variantId}` : ''}`,
    );

    await this.assertOwnerExists(data.productId, variantId);

    return this.prisma.client.$transaction(async (transaction) => {
      if (data.isPrimary) {
        await transaction.productImage.updateMany({
          where: { productId: data.productId, variantId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return transaction.productImage.create({
        data: {
          url: data.url,
          alt: data.alt,
          sortOrder: data.sortOrder,
          isPrimary: data.isPrimary,
          productId: data.productId,
          variantId,
        },
      });
    });
  }

  async updateById(id: string, data: UpdateProductImagesDto) {
    this.logger.log(
      `Updating product image ${id} with data ${JSON.stringify(data)}`,
    );

    const image = await this.getById(id);
    const productId = data.productId ?? image.productId;
    const variantId =
      data.variantId === undefined ? image.variantId : data.variantId;
    const isPrimary = data.isPrimary ?? image.isPrimary;

    await this.assertOwnerExists(productId, variantId);

    return this.prisma.client.$transaction(async (transaction) => {
      if (isPrimary) {
        await transaction.productImage.updateMany({
          where: {
            id: { not: id },
            productId,
            variantId,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      return transaction.productImage.update({
        where: { id },
        data: {
          url: data.url,
          alt: data.alt,
          sortOrder: data.sortOrder,
          isPrimary: data.isPrimary,
          productId: data.productId,
          variantId: data.variantId,
        },
      });
    });
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

  private async assertOwnerExists(productId: string, variantId: string | null) {
    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (variantId === null) {
      return;
    }

    const variant = await this.prisma.client.productVariant.findFirst({
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
