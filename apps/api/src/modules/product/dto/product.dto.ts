import { ProductListItemSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProductDto extends createZodDto(ProductListItemSchema) {}
