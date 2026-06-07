import { UpdateCategorySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
