import { PublicReviewsResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class PublicReviewsPageDto extends createZodDto(
  PublicReviewsResponseSchema,
) {}
