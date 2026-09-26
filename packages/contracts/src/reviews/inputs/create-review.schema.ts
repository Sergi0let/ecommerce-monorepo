import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const CreateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).nullable().optional(),
    productId: UuidSchema,
  })
  .strict();
