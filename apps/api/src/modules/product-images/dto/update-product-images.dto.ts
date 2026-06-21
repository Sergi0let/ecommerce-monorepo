import { UpdateProductImagesSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateProductImagesDto extends createZodDto(
  UpdateProductImagesSchema,
) {}
