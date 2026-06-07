import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryListItemType } from '@repo/contracts';

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
        brandId: true,
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
        brandId: true,
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
        brandId: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }

  async create(data: CreateCategoryDto): Promise<CategoryListItemType> {
    this.logger.log(`Creating category ${data.name} with slug ${data.slug}`);

    await this.assertBrandExists(data.brandId);
    await this.assertParentValid(data.parentId, data.brandId);
    await this.assertSlugAvailable(data.slug);

    return this.prisma.client.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId ?? null,
        brandId: data.brandId,
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

    const category = await this.findById(id);
    const brandId = data.brandId ?? category.brandId;

    if (data.brandId) {
      await this.assertBrandExists(data.brandId);
    }

    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new ConflictException('Category cannot be its own parent');
      }
      await this.assertParentValid(data.parentId, brandId);
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
        brandId: data.brandId,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        brandId: true,
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

  private async assertBrandExists(brandId: string) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }
  }

  private async assertParentValid(
    parentId: string | null | undefined,
    brandId: string,
  ) {
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

    if (parent.brandId !== brandId) {
      throw new ConflictException(
        'Parent category must belong to the same brand',
      );
    }
  }
}
