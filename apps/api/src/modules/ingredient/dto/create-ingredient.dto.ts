import { CreateIngredientSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateIngredientDto extends createZodDto(CreateIngredientSchema) {}
