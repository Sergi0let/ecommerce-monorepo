import { CreateProductVariantSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateProductVariantDto extends createZodDto(
  CreateProductVariantSchema,
) {}
