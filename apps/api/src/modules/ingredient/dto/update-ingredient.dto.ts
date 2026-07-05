import { UpdateIngredientSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateIngredientDto extends createZodDto(UpdateIngredientSchema) {}
