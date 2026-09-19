import { z } from 'zod';

import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const ProductImageSchema = z.object({
  id: UuidSchema,
  storageKeyBase: z.string().min(1),
  thumbnailUrl: z.url(),
  mediumUrl: z.url(),
  largeUrl: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  createdAt: TimestampSchema,
  productId: UuidSchema,
  variantId: UuidSchema.nullable(),
});
