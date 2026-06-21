import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@Injectable()
export class ProductVariantService {
  private readonly logger = new Logger(ProductVariantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductVariantDto) {
    this.logger.log(`Creating product variant ${data.sku}`);

    await this.assertProductExistsById(data.productId);
    await this.assertSkuAvailable(data.sku);
    await this.assertSlugAvailable(data.slug);

    const variantsCount = await this.prisma.client.productVariant.count({
      where: { productId: data.productId },
    });
    const shouldBeDefault = data.isDefault || variantsCount === 0;

    if (shouldBeDefault) {
      return this.prisma.client.$transaction(async (transaction) => {
        await transaction.productVariant.updateMany({
          where: { productId: data.productId, isDefault: true },
          data: { isDefault: false },
        });

        return transaction.productVariant.create({
          data: { ...data, isDefault: true },
        });
      });
    }

    return this.prisma.client.productVariant.create({ data });
  }

  async updateById(id: string, data: UpdateProductVariantDto) {
    this.logger.log(
      `Updating product variant ${id} with data ${JSON.stringify(data)}`,
    );

    const variant = await this.getById(id);

    if (data.sku) {
      await this.assertSkuAvailable(data.sku, id);
    }

    if (data.slug) {
      await this.assertSlugAvailable(data.slug, id);
    }

    if (data.isDefault === false && variant.isDefault) {
      throw new BadRequestException(
        'Set another variant as default before unsetting the current default',
      );
    }

    if (data.isDefault === true && !variant.isDefault) {
      return this.prisma.client.$transaction(async (transaction) => {
        await transaction.productVariant.updateMany({
          where: { productId: variant.productId, isDefault: true },
          data: { isDefault: false },
        });

        return transaction.productVariant.update({
          where: { id },
          data,
        });
      });
    }

    return this.prisma.client.productVariant.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    this.logger.log(`Deleting Product Variant ${id}`);

    const variant = await this.getById(id);
    const replacement = await this.prisma.client.productVariant.findFirst({
      where: { productId: variant.productId, id: { not: id } },
      orderBy: { createdAt: 'asc' },
    });

    if (!replacement) {
      throw new ConflictException('Cannot delete the last product variant');
    }

    return this.prisma.client.$transaction(async (transaction) => {
      const deletedVariant = await transaction.productVariant.delete({
        where: { id },
      });

      if (variant.isDefault) {
        await transaction.productVariant.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
      }

      return deletedVariant;
    });
  }

  async getById(id: string) {
    const productVariant = await this.prisma.client.productVariant.findUnique({
      where: { id },
    });

    if (!productVariant) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }

    return productVariant;
  }

  async getByProductSlug(slug: string) {
    await this.assertProductExistsBySlug(slug);

    return this.prisma.client.productVariant.findMany({
      where: { product: { slug } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  private async assertSkuAvailable(sku: string, excludeId?: string) {
    const productVariant = await this.prisma.client.productVariant.findUnique({
      where: { sku },
    });

    if (productVariant && productVariant.id !== excludeId) {
      throw new ConflictException(
        `Product variant with SKU "${sku}" already exists`,
      );
    }
  }

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const productVariant = await this.prisma.client.productVariant.findUnique({
      where: { slug },
    });

    if (productVariant && productVariant.id !== excludeId) {
      throw new ConflictException(
        `Product variant with slug "${slug}" already exists`,
      );
    }
  }

  private async assertProductExistsById(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  private async assertProductExistsBySlug(slug: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { slug },
    });

    if (!product) {
      throw new NotFoundException(`Product with SLUG ${slug} not found`);
    }
  }
}
