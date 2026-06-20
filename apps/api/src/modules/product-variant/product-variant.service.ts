import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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

    return this.prisma.client.productVariant.create({
      data: {
        sku: data.sku,
        name: data.name,
        volumeMl: data.volumeMl,
        weightG: data.weightG,
        isActive: data.isActive,
        productId: data.productId,
      },
    });
  }

  async updateById(id: string, data: UpdateProductVariantDto) {
    this.logger.log(
      `Updating product variant ${id} with data ${JSON.stringify(data)}`,
    );

    await this.assertProductVariantExistsById(id);

    if (data.productId) {
      await this.assertProductExistsById(data.productId);
    }

    if (data.sku) {
      await this.assertSkuAvailable(data.sku, id);
    }

    return this.prisma.client.productVariant.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    this.logger.log(`Deleting Product Variant ${id}`);

    await this.assertProductVariantExistsById(id);

    return this.prisma.client.productVariant.delete({ where: { id } });
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
      where: {
        product: {
          slug,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async assertProductVariantExistsById(id: string) {
    const productVariant = await this.prisma.client.productVariant.findUnique({
      where: { id },
    });

    if (!productVariant) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }
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
