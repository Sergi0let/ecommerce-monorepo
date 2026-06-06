import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PrismaService } from '../../prisma/prisma.service';

const activePriceFilter = {
  isValidFrom: { lte: new Date() },
  OR: [{ isValidTo: null }, { isValidTo: { gte: new Date() } }],
};

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  constructor(private readonly prisma: PrismaService) {}

  findAll(isActive?: boolean) {
    return this.prisma.client.brand.findMany({
      where: isActive !== undefined ? { isActive } : {},
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true, categories: true } },
      },
    });
  }

  findAllNames() {
    return this.prisma.client.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        isActive: true,
      },
    });
  }

  async findById(id: string) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { id },
      include: {
        categories: true,
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async findBySlug(slug: string) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { slug },
      include: {
        products: {
          where: { isActive: true },
          include: {
            prices: {
              where: activePriceFilter,
              take: 1,
            },
          },
        },
        categories: true,
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug ${slug} not found`);
    }

    return brand;
  }

  create(data: CreateBrandDto) {
    this.logger.log(`Creating brand ${data.name} with slug ${data.slug}`);

    try {
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
    } catch (error) {
      this.logger.error(`Error creating brand ${data.name}: ${error}`);
      throw error;
    }
  }

  async update(id: string, data: UpdateBrandDto) {
    this.logger.log(`Updating brand ${id} with data ${JSON.stringify(data)}`);

    await this.findById(id);

    if (data.slug) {
      const existing = await this.prisma.client.brand.findUnique({
        where: { slug: data.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Brand with slug ${data.slug} already exists`,
        );
      }
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
      this.logger.error(`Brand with ID ${id} not found`);
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    if (brand._count.products > 0 || brand._count.categories > 0) {
      this.logger.error(
        `Cannot delete brand ${id} with associated products or categories`,
      );
      throw new ConflictException(
        'Cannot delete brand with associated products or categories',
      );
    }

    await this.prisma.client.brand.delete({ where: { id } });
    this.logger.log(`Brand ${id} deleted successfully`);
  }

  async getProducts(brandId: string, page: number = 1, limit: number = 10) {
    await this.findById(brandId);

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { brandId, isActive: true },
        skip,
        take: safeLimit,
        include: {
          prices: { where: activePriceFilter, take: 1 },
          images: { orderBy: { sortOrder: 'asc' } },
        },
      }),
      this.prisma.client.product.count({ where: { brandId, isActive: true } }),
    ]);

    return {
      data: products,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }
}
