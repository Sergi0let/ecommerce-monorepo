import { BrandProductsResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandProductsPageDto extends createZodDto(
  BrandProductsResponseSchema,
) {}
