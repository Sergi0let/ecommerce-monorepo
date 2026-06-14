import { CategoryProductsQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CategoryProductsQueryDto extends createZodDto(
  CategoryProductsQuerySchema,
) {}
