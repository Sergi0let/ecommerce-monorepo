import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BrandProductsPageType, CategoryListItemType } from '@repo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
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

  findAll(): Promise<CategoryListItemType[]> {
    return this.prisma.client.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        metaTitle: true,
        metaDescription: true,
      },
    });
  }

  async findById(id: string): Promise<CategoryListItemType> {
    const category = await this.prisma.client.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async findBySlug(slug: string): Promise<CategoryListItemType> {
    const category = await this.prisma.client.category.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }

  async getProductsBySlug(
    slug: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<BrandProductsPageType> {
    const category = await this.prisma.client.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const where = { categoryId: category.id, isActive: true };

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { name: 'asc' },
        include: {
          prices: { where: activePriceFilter, take: 1 },
          images: { orderBy: { sortOrder: 'asc' } },
        },
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return {
      data: products.map((product) => ({
        ...product,
        deletedAt: product.deletedAt?.toISOString() ?? null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        prices: product.prices.map((price) => ({
          ...price,
          isValidFrom: price.isValidFrom?.toISOString() ?? null,
          isValidTo: price.isValidTo?.toISOString() ?? null,
          createdAt: price.createdAt.toISOString(),
          updatedAt: price.updatedAt?.toISOString() ?? null,
        })),
        images: product.images.map((image) => ({
          ...image,
          createdAt: image.createdAt.toISOString(),
        })),
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async create(data: CreateCategoryDto): Promise<CategoryListItemType> {
    this.logger.log(`Creating category ${data.name} with slug ${data.slug}`);

    await this.assertParentExists(data.parentId);
    await this.assertSlugAvailable(data.slug);

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

  async update(
    id: string,
    data: UpdateCategoryDto,
  ): Promise<CategoryListItemType> {
    this.logger.log(
      `Updating category ${id} with data ${JSON.stringify(data)}`,
    );

    await this.findById(id);

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
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        metaTitle: true,
        metaDescription: true,
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
