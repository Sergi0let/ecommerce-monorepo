import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const ProductImageInputBaseSchema = z.strictObject({
  alt: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative().max(2_147_483_647),
  isPrimary: z.boolean(),
  variantId: UuidSchema.nullable().optional(),
});

export const CreateProductImagesSchema = ProductImageInputBaseSchema.extend({
  sortOrder: ProductImageInputBaseSchema.shape.sortOrder.default(0),
  isPrimary: z.boolean().default(false),
});
