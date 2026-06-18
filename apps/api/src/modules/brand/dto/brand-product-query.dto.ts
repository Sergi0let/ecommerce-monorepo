import { BrandProductsQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandProductsQueryDto extends createZodDto(
  BrandProductsQuerySchema,
) {}
