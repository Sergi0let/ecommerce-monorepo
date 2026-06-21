import { ProductImageSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProductImagesDto extends createZodDto(ProductImageSchema) {}
