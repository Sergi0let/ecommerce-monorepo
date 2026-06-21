import { CreateProductImagesSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateProductImagesDto extends createZodDto(
  CreateProductImagesSchema,
) {}
