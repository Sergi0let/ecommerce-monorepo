import { IngredientSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class IngredientDto extends createZodDto(IngredientSchema) {}
