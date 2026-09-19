import { z } from 'zod';
import { UuidSchema } from '../../common/index.js';
import {
  CreateProductImagesSchema,
  ProductImageInputBaseSchema,
} from './create-product-images.schema.js';

// Multipart fields are strings. Reject arrays, objects, empty numbers and
// unknown fields before applying the canonical metadata validation/defaults.
export const UploadProductImageSchema = CreateProductImagesSchema.extend({
  alt: z.string().optional(),
  variantId: UuidSchema.optional(),
  sortOrder: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(ProductImageInputBaseSchema.shape.sortOrder)
    .default(0),
  isPrimary: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false),
});
