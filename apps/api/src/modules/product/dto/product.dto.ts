import { ProductCoreSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProductDto extends createZodDto(ProductCoreSchema) {}
