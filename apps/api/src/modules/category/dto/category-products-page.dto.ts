import { CategoryProductsResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CategoryProductsPageDto extends createZodDto(
  CategoryProductsResponseSchema,
) {}
