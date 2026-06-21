import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const ProductImageInputBaseSchema = z.object({
  url: z.url(),
  alt: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  productId: UuidSchema,
  variantId: UuidSchema.nullable().optional(),
});

export const CreateProductImagesSchema = ProductImageInputBaseSchema.extend({
  sortOrder: z.number().int().nonnegative().default(0),
  isPrimary: z.boolean().default(false),
});
