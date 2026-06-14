import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { BrandSummariesPageType } from '@repo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandProductsQueryDto } from './dto/brand-product-query.dto';
import { BrandsQueryDto } from './dto/brands-query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

const activePriceFilter = {
  isValidFrom: { lte: new Date() },
  OR: [{ isValidTo: null }, { isValidTo: { gte: new Date() } }],
};

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateBrandDto) {
    this.logger.log(`Creating brand ${data.name} with slug ${data.slug}`);

    await this.assertSlugAvailable(data.slug);

    return this.prisma.client.brand.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logo: data.logo,
        websiteUrl: data.websiteUrl,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: UpdateBrandDto) {
    this.logger.log(`Updating brand ${id} with data ${JSON.stringify(data)}`);

    await this.getById(id);

    if (data.slug !== undefined) {
      await this.assertSlugAvailable(data.slug, id);
    }

    return this.prisma.client.brand.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logo: data.logo,
        websiteUrl: data.websiteUrl,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        isActive: data.isActive,
      },
    });
  }

  async delete(id: string) {
    this.logger.log(`Deleting brand ${id}`);

    const brand = await this.prisma.client.brand.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, categories: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    if (brand._count.products > 0 || brand._count.categories > 0) {
      throw new ConflictException(
        'Cannot delete brand with associated products or categories',
      );
    }

    await this.prisma.client.brand.delete({ where: { id } });

    this.logger.log(`Brand ${id} deleted successfully`);
  }

  getAll(query: BrandsQueryDto) {
    const { sort, isActive } = query;

    return this.prisma.client.brand.findMany({
      where: isActive !== undefined ? { isActive } : {},
      orderBy: { createdAt: sort },
    });
  }

  async getById(id: string) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async findAllSummaries(
    query: BrandProductsQueryDto,
  ): Promise<BrandSummariesPageType> {
    const { limit = 10, page = 1, sort = 'desc', isActive = true } = query;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;
    const where = { isActive };

    const [brands, total] = await Promise.all([
      this.prisma.client.brand.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { name: sort },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          isActive: true,
          _count: {
            select: {
              categories: true,
              products: true,
            },
          },
        },
      }),
      this.prisma.client.brand.count({ where }),
    ]);

    return {
      data: brands.map(({ _count, ...brand }) => ({
        ...brand,
        categoriesCount: _count.categories,
        productsCount: _count.products,
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getProductsBySlug(slug: string, query: BrandProductsQueryDto) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug ${slug} not found`);
    }

    const { limit = 10, page = 1, sort = 'desc', isActive = true } = query;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;
    const where = { brandId: brand.id, isActive };

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          prices: { where: activePriceFilter, take: 1 },
          images: { orderBy: { sortOrder: sort } },
        },
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return {
      data: products,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getBySlug(slug: string) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { slug },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug ${slug} not found`);
    }

    return brand;
  }

  // TODO create class for extends
  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.client.brand.findUnique({
      where: { slug },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Brand with slug "${slug}" already exists`);
    }
  }
}
