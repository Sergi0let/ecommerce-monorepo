import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const getProductRelationsInclude = () => {
  const now = new Date();
  const activePriceWhere = {
    OR: [{ isValidFrom: null }, { isValidFrom: { lte: now } }],
    AND: [{ OR: [{ isValidTo: null }, { isValidTo: { gte: now } }] }],
  };

  return {
    prices: {
      where: {
        ...activePriceWhere,
        variantId: null,
      },
      orderBy: { isValidFrom: 'desc' as const },
      take: 1,
    },
    images: {
      orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    },
    variants: {
      include: {
        prices: {
          where: activePriceWhere,
          orderBy: { isValidFrom: 'desc' as const },
          take: 1,
        },
      },
    },
  };
};

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductDto) {
    this.logger.log(`Creating Product ${data.name} with slug ${data.slug}`);

    await this.assertBrandExists(data.brandId);
    await this.assertCategoryExists(data.categoryId);
    await this.assertSlugAvailable(data.slug);

    return this.prisma.client.product.create({
      include: getProductRelationsInclude(),
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        volumeMl: data.volumeMl,
        weightG: data.weightG,
        isActive: data.isActive,
        brandId: data.brandId,
        categoryId: data.categoryId ?? null,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
      },
    });
  }

  async updateById(id: string, data: UpdateProductDto) {
    this.logger.log(`Updating product ${id} with data ${JSON.stringify(data)}`);

    const product = await this.getById(id);
    const categoryId =
      data.categoryId === undefined ? product.categoryId : data.categoryId;

    if (data.brandId) {
      await this.assertBrandExists(data.brandId);
    }

    if (data.categoryId !== undefined) {
      await this.assertCategoryExists(categoryId);
    }

    if (data.slug) {
      await this.assertSlugAvailable(data.slug, id);
    }

    return this.prisma.client.product.update({
      where: { id },
      include: getProductRelationsInclude(),
      data,
    });
  }

  async delete(id: string) {
    this.logger.log(`Deleting Product ${id}`);

    await this.getById(id);

    return this.prisma.client.product.delete({ where: { id } });
  }

  async getAll(query: ProductsQueryDto) {
    const { limit = 10, page = 1, sort, isActive } = query;
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;
    const where = isActive !== undefined ? { isActive } : {};

    return Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: sort },
        include: getProductRelationsInclude(),
      }),
      this.prisma.client.product.count({ where }),
    ]).then(([products, total]) => ({
      data: products,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    }));
  }

  async getById(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      include: getProductRelationsInclude(),
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async getBySlug(slug: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { slug },
      include: getProductRelationsInclude(),
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    return product;
  }

  private async assertBrandExists(brandId: string) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }
  }

  private async assertCategoryExists(categoryId: string | null | undefined) {
    if (categoryId == null) {
      return;
    }

    const category = await this.prisma.client.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }
  }

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.client.product.findUnique({
      where: { slug },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Product with slug "${slug}" already exists`);
    }
  }
}
