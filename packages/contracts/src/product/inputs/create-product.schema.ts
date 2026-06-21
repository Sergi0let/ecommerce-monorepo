import { z } from 'zod';

import { SlugSchema, UuidSchema } from '../../common/primitives.js';
import { ProductVariantInputSchema } from '../../product-variant/index.js';

export const ProductInputBaseSchema = z.object({
  name: z.string().min(3),
  slug: SlugSchema,
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  brandId: UuidSchema,
  categoryId: UuidSchema.nullish(),
  metaTitle: z.string().max(255).nullable().optional(),
  metaDescription: z.string().max(255).nullable().optional(),
});

export const CreateProductSchema = ProductInputBaseSchema.extend({
  isActive: z.boolean().default(true),
  initialVariant: ProductVariantInputSchema,
});
