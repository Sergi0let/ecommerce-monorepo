import { ProductPriceSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProductPriceDto extends createZodDto(ProductPriceSchema) {}
