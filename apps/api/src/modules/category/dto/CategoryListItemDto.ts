import { CategoryListItemSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CategoryListItemDto extends createZodDto(CategoryListItemSchema) {}
