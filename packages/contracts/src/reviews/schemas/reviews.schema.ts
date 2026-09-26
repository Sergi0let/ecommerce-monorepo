import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const ReviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const ReviewSchema = z.object({
  id: UuidSchema,

  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),

  status: ReviewStatusSchema,

  verifiedPurchase: z.boolean(),
  helpfulCount: z.number().int().nonnegative(),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,

  userId: z.number().int().positive(),
  productId: UuidSchema,
});
