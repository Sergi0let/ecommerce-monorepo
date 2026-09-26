import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const PublicReviewAuthorSchema = z.object({
  firstName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});

export const PublicReviewViewSchema = z.object({
  id: UuidSchema,
  productId: UuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  verifiedPurchase: z.boolean(),
  helpfulCount: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  author: PublicReviewAuthorSchema,
});
