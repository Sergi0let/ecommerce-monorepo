import { z } from 'zod';

import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const ProductImageSchema = z.object({
  id: UuidSchema,
  url: z.url(),
  alt: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  createdAt: TimestampSchema,
  productId: UuidSchema,
  variantId: UuidSchema.nullable(),
});
