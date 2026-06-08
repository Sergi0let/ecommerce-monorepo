import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.product.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async create(data: CreateProductDto) {
    await this.assertBrandExists(data.brandId);
    await this.assertCategoryValid(data.categoryId, data.brandId);
    await this.assertSlugAvailable(data.slug);

    return this.prisma.client.product.create({
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

  async update(id: string, data: UpdateProductDto) {
    const product = await this.findById(id);
    const brandId = data.brandId ?? product.brandId;
    const categoryId =
      data.categoryId === undefined ? product.categoryId : data.categoryId;

    if (data.brandId) {
      await this.assertBrandExists(data.brandId);
    }

    if (data.brandId || data.categoryId !== undefined) {
      await this.assertCategoryValid(categoryId, brandId);
    }

    if (data.slug) {
      await this.assertSlugAvailable(data.slug, id);
    }

    return this.prisma.client.product.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return this.prisma.client.product.delete({ where: { id } });
  }

  private async assertBrandExists(brandId: string) {
    const brand = await this.prisma.client.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }
  }

  private async assertCategoryValid(
    categoryId: string | null | undefined,
    brandId: string,
  ) {
    if (categoryId == null) {
      return;
    }

    const category = await this.prisma.client.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    if (category.brandId !== brandId) {
      throw new ConflictException(
        'Category must belong to the same brand as product',
      );
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
