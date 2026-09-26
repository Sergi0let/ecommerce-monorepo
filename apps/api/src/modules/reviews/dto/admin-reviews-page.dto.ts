import { AdminReviewsResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class AdminReviewsPageDto extends createZodDto(
  AdminReviewsResponseSchema,
) {}
