import { CreateProductPriceSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateProductPriceDto extends createZodDto(
  CreateProductPriceSchema,
) {}
