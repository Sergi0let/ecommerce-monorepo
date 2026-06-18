import { ProductsResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProductsResponseDto extends createZodDto(ProductsResponseSchema) {}
