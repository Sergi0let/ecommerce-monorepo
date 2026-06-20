import { UpdateProductVariantSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateProductVariantDto extends createZodDto(
  UpdateProductVariantSchema,
) {}
