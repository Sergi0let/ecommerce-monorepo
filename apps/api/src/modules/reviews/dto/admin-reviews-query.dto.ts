import { AdminReviewsQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class AdminReviewsQueryDto extends createZodDto(
  AdminReviewsQuerySchema,
) {}
