import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const ProductPriceSchema = z.object({
  id: UuidSchema,
  variantId: UuidSchema,
  currency: z.string(),
  amountCents: z.number().int(),
  costCents: z.number().int().nullable(),
  compareAtCents: z.number().int().nullable(),
  isValidFrom: TimestampSchema.nullable(),
  isValidTo: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.nullable(),
});
