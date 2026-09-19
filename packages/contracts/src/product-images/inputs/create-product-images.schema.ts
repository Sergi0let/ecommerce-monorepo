import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const ProductImageInputBaseSchema = z.strictObject({
  alt: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  variantId: UuidSchema.nullable().optional(),
});

export const CreateProductImagesSchema = ProductImageInputBaseSchema.extend({
  sortOrder: z.number().int().nonnegative().default(0),
  isPrimary: z.boolean().default(false),
});
