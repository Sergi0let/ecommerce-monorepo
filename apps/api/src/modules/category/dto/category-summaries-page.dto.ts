import { CategorySummariesResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CategorySummariesPageDto extends createZodDto(
  CategorySummariesResponseSchema,
) {}
