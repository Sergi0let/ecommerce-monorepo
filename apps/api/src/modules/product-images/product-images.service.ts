import {
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { UpdateProductImagesDto } from './dto/update-product-images.dto';

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    productId: string,
    data: CreateProductImagesDto,
  ): Promise<never> {
    const variantId = data.variantId ?? null;
    await this.assertOwnerExists(productId, variantId);

    // TODO: Process the uploaded file with Sharp, upload to R2, then persist metadata.
    throw new NotImplementedException(
      'Product image upload is not available until Sharp/R2 integration is implemented',
    );
  }

  async updateById(id: string, data: UpdateProductImagesDto) {
    this.logger.log(
      `Updating product image ${id} with data ${JSON.stringify(data)}`,
    );

    const image = await this.getById(id);
    const { productId, variantId } = image;
    const isPrimary = data.isPrimary ?? image.isPrimary;

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
          alt: data.alt,
          sortOrder: data.sortOrder,
          isPrimary: data.isPrimary,
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
