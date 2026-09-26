import { PublicReviewsQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class PublicReviewsQueryDto extends createZodDto(
  PublicReviewsQuerySchema,
) {}
