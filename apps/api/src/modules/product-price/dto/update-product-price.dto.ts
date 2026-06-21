import { UpdateProductPriceSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateProductPriceDto extends createZodDto(
  UpdateProductPriceSchema,
) {}
