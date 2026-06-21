import { z } from 'zod';

import { TimestampSchema, UuidSchema } from '../../common/primitives.js';
import { ProductVariantSchema } from '../../product-variant/index.js';
import { PriceSchema } from './price.schema.js';

const ProductVariantWithPricesSchema = ProductVariantSchema.extend({
  prices: z.array(PriceSchema),
});

export const ProductCoreSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  volumeMl: z.number().int().nullable(),
  weightG: z.number().int().nullable(),
  isActive: z.boolean(),
  deletedAt: TimestampSchema.nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  ratingAvg: z.number().nullable(),
  ratingCount: z.number().int(),
  brandId: UuidSchema,
  variants: z.array(ProductVariantWithPricesSchema),
  categoryId: UuidSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
