import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CategoryProductsQueryType,
  CategorySummariesPageType,
} from '@repo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesQueryDto } from './dto/categories-query.dto';
import { CategoryProductsQueryDto } from './dto/category-products-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const activePriceFilter = {
  isValidFrom: { lte: new Date() },
  OR: [{ isValidTo: null }, { isValidTo: { gte: new Date() } }],
};

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCategoryDto) {
    this.logger.log(`Creating category ${data.name} with slug ${data.slug}`);

    await this.assertSlugAvailable(data.slug);
    await this.assertParentExists(data.parentId);

    return this.prisma.client.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId ?? null,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
      },
    });
  }

  async updateById(id: string, data: UpdateCategoryDto) {
    this.logger.log(
      `Updating category ${id} with data ${JSON.stringify(data)}`,
    );

    await this.getById(id);

    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new ConflictException('Category cannot be its own parent');
      }
      await this.assertParentExists(data.parentId);
    }

    if (data.slug) {
      await this.assertSlugAvailable(data.slug, id);
    }

    return this.prisma.client.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
      },
    });
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting category ${id}`);

    const category = await this.prisma.client.category.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (category._count.children > 0 || category._count.products > 0) {
      throw new ConflictException(
        'Cannot delete category with associated child categories or products',
      );
    }

    await this.prisma.client.category.delete({ where: { id } });

    this.logger.log(`Category ${id} deleted successfully`);
  }

  getAll(query: CategoriesQueryDto) {
    const { sort = 'desc' } = query;

    return this.prisma.client.category.findMany({
      orderBy: { createdAt: sort },
    });
  }

  async getById(id: string) {
    const category = await this.prisma.client.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async getAllSummaries(
    query: CategoryProductsQueryDto,
  ): Promise<CategorySummariesPageType> {
    const { limit = 10, page = 1, sort = 'desc' } = query;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const [categories, total] = await Promise.all([
      this.prisma.client.category.findMany({
        skip,
        take: safeLimit,
        orderBy: { name: sort },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          metaTitle: true,
          metaDescription: true,
          _count: {
            select: {
              children: true,
              products: true,
            },
          },
        },
      }),
      this.prisma.client.category.count(),
    ]);

    return {
      data: categories.map(({ _count, ...category }) => ({
        ...category,
        childrenCount: _count.children,
        productsCount: _count.products,
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getBySlug(slug: string) {
    const category = await this.prisma.client.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }

  async getProductsBySlug(slug: string, query: CategoryProductsQueryType) {
    const category = await this.prisma.client.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    const { limit = 10, page = 1, sort = 'desc' } = query;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;
    const where = { categoryId: category.id, isActive: true };

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
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

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.client.category.findUnique({
      where: { slug },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Category with slug "${slug}" already exists`,
      );
    }
  }

  private async assertParentExists(parentId: string | null | undefined) {
    if (parentId == null) {
      return;
    }

    const parent = await this.prisma.client.category.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(
        `Parent category with ID ${parentId} not found`,
      );
    }
  }
}
