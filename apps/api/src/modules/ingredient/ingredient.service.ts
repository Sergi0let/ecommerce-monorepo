import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Injectable()
export class IngredientService {
  private readonly logger = new Logger(IngredientService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateIngredientDto) {
    this.logger.log(`Creating ingredient ${data.name} with slug ${data.slug}`);

    await this.assertSlugAvailable(data.slug);

    return this.prisma.client.ingredient.create({
      data: {
        name: data.name,
        slug: data.slug,
        inciName: data.inciName,
        description: data.description,
        comedogenicRating: data.comedogenicRating,
        safetyScore: data.safetyScore,
        isAllergen: data.isAllergen,
        isPreservative: data.isPreservative,
        isFragrance: data.isFragrance,
        benefits: data.benefits,
        restrictions: data.restrictions,
      },
    });
  }

  async updateById(id: string, data: UpdateIngredientDto) {
    this.logger.log(
      `Updating ingredient ${id} with data ${JSON.stringify(data)}`,
    );

    await this.getById(id);

    if (data.slug !== undefined) {
      await this.assertSlugAvailable(data.slug, id);
    }

    return this.prisma.client.ingredient.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        inciName: data.inciName,
        description: data.description,
        comedogenicRating: data.comedogenicRating,
        safetyScore: data.safetyScore,
        isAllergen: data.isAllergen,
        isPreservative: data.isPreservative,
        isFragrance: data.isFragrance,
        benefits: data.benefits,
        restrictions: data.restrictions,
      },
    });
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting ingredient ${id}`);

    await this.getById(id);

    await this.prisma.client.ingredient.delete({ where: { id } });

    this.logger.log(`Ingredient ${id} deleted successfully`);
  }

  async getById(id: string) {
    const ingredient = await this.prisma.client.ingredient.findUnique({
      where: { id },
    });

    if (!ingredient) {
      throw new NotFoundException(`Ingredient with ID ${id} not found`);
    }

    return ingredient;
  }

  getAll() {
    return this.prisma.client.ingredient.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.client.ingredient.findUnique({
      where: { slug },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Ingredient with slug "${slug}" already exists`,
      );
    }
  }
}
