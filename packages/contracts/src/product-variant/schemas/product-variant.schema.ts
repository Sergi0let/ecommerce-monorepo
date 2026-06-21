import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const ProductVariantSchema = z.object({
  id: UuidSchema,
  slug: z.string(),
  sku: z.string(),
  name: z.string().nullable(),
  volumeMl: z.number().int().nullable(),
  weightG: z.number().int().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  productId: UuidSchema,
});
