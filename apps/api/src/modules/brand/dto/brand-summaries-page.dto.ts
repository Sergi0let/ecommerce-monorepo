import { BrandSummariesResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandSummariesPageDto extends createZodDto(
  BrandSummariesResponseSchema,
) {}
