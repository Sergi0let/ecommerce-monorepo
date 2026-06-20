import { ProductVariantSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProductVariantDto extends createZodDto(ProductVariantSchema) {}
