import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Brand } from '@repo/database';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandService {
  async findAll(): Promise<Brand[]> {
    return prisma.brand.findMany({
      include: {
        products: true,
        categories: true,
      },
    });
  }

  async findAllNames(): Promise<
    Pick<Brand, 'id' | 'name' | 'slug' | 'logo' | 'isActive'>[]
  > {
    return prisma.brand.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        isActive: true,
      },
    });
  }

  async findById(id: string): Promise<Brand> {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        products: true,
        categories: true,
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async findBySlug(slug: string): Promise<Brand> {
    const brand = await prisma.brand.findUnique({
      where: { slug },
      include: {
        products: {
          where: { isActive: true },
          include: {
            prices: {
              where: {
                isValidFrom: { lte: new Date() },
                OR: [{ isValidTo: null }, { isValidTo: { gte: new Date() } }],
              },
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

  async create(data: CreateBrandDto): Promise<Brand> {
    return prisma.brand.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logo: data.logo,
        websiteUrl: data.websiteUrl,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: UpdateBrandDto): Promise<Brand> {
    await this.findById(id);

    return prisma.brand.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logo: data.logo,
        websiteUrl: data.websiteUrl,
        isActive: data.isActive,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prisma.brand.delete({ where: { id } });
  }

  async getProducts(brandId: string) {
    await this.findById(brandId);

    return prisma.product.findMany({
      where: { brandId, isActive: true },
      include: {
        prices: {
          where: {
            isValidFrom: { lte: new Date() },
            OR: [{ isValidTo: null }, { isValidTo: { gte: new Date() } }],
          },
          take: 1,
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }
}
