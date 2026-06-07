import { CategorySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CategoryDto extends createZodDto(CategorySchema) {}
