import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductPriceDto } from './dto/create-product-price.dto';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';

@Injectable()
export class ProductPriceService {
  private readonly logger = new Logger(ProductPriceService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductPriceDto) {
    this.logger.log(`Creating product price for variant ${data.variantId}`);

    await this.assertVariantExists(data.variantId);

    return this.prisma.client.price.create({
      data: {
        variantId: data.variantId,
        currency: data.currency,
        amountCents: data.amountCents,
        costCents: data.costCents,
        compareAtCents: data.compareAtCents,
        isValidFrom: this.toDateOrUndefined(data.isValidFrom),
        isValidTo: this.toDateOrUndefined(data.isValidTo),
      },
    });
  }

  async updateById(id: string, data: UpdateProductPriceDto) {
    this.logger.log(
      `Updating product price ${id} with data ${JSON.stringify(data)}`,
    );

    const productPrice = await this.getById(id);
    this.assertValidPriceUpdate(productPrice, data);

    return this.prisma.client.price.update({
      where: { id },
      data: {
        currency: data.currency,
        amountCents: data.amountCents,
        costCents: data.costCents,
        compareAtCents: data.compareAtCents,
        isValidFrom: this.toDateOrUndefined(data.isValidFrom),
        isValidTo: this.toDateOrUndefined(data.isValidTo),
      },
    });
  }

  async delete(id: string) {
    this.logger.log(`Deleting product price ${id}`);

    await this.getById(id);

    return this.prisma.client.price.delete({ where: { id } });
  }

  getAll() {
    return this.prisma.client.price.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const productPrice = await this.prisma.client.price.findUnique({
      where: { id },
    });

    if (!productPrice) {
      throw new NotFoundException(`Product price with ID ${id} not found`);
    }

    return productPrice;
  }

  private async assertVariantExists(variantId: string) {
    const variant = await this.prisma.client.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException(
        `Product variant with ID ${variantId} not found`,
      );
    }
  }

  private assertValidPriceUpdate(
    productPrice: Awaited<ReturnType<ProductPriceService['getById']>>,
    data: UpdateProductPriceDto,
  ) {
    const amountCents = data.amountCents ?? productPrice.amountCents;
    const compareAtCents =
      data.compareAtCents === undefined
        ? productPrice.compareAtCents
        : data.compareAtCents;

    if (compareAtCents != null && compareAtCents < amountCents) {
      throw new BadRequestException(
        'compareAtCents must be greater than or equal to amountCents',
      );
    }

    const isValidFrom =
      data.isValidFrom === undefined
        ? productPrice.isValidFrom
        : this.toDateOrNull(data.isValidFrom);
    const isValidTo =
      data.isValidTo === undefined
        ? productPrice.isValidTo
        : this.toDateOrNull(data.isValidTo);

    if (isValidFrom && isValidTo && isValidFrom > isValidTo) {
      throw new BadRequestException(
        'isValidTo must be greater than or equal to isValidFrom',
      );
    }
  }

  private toDateOrUndefined(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    return this.toDateOrNull(value);
  }

  private toDateOrNull(value: string | null) {
    return value === null ? null : new Date(value);
  }
}
