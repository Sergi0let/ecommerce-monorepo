import { z } from 'zod';
import { SlugSchema, UuidSchema } from '../../common/primitives.js';

export const ProductVariantInputBaseSchema = z.object({
  slug: SlugSchema,
  sku: z.string().min(1),
  name: z.string().min(3).nullable().optional(),
  volumeMl: z.number().int().positive().nullable().optional(),
  weightG: z.number().int().positive().nullable().optional(),
  isActive: z.boolean(),
});

export const ProductVariantInputSchema = ProductVariantInputBaseSchema.extend({
  isActive: z.boolean().default(true),
});

export const CreateProductVariantSchema = ProductVariantInputSchema.extend({
  productId: UuidSchema,
  isDefault: z.boolean().default(false),
});
