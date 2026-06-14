import { BrandProductsResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CategoryProductsPageDto extends createZodDto(
  BrandProductsResponseSchema,
) {}
