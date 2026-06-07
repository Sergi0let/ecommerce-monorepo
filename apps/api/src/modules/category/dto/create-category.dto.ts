import { CreateCategorySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
