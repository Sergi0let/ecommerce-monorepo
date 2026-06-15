import { ProductQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProductsQueryDto extends createZodDto(ProductQuerySchema) {}
