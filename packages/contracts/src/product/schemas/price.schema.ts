import { z } from 'zod';

import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

/** Public catalog price. Internal costs belong to ProductPriceSchema only. */
export const PriceSchema = z.object({
  id: UuidSchema,
  variantId: UuidSchema,
  currency: z.string(),
  amountCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  isValidFrom: TimestampSchema.nullable(),
  isValidTo: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.nullable(),
});
