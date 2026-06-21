import { z } from 'zod';
import { ProductVariantInputBaseSchema } from './create-product-variant.schema.js';

export const UpdateProductVariantSchema =
  ProductVariantInputBaseSchema.partial().extend({
    isDefault: z.boolean().optional(),
  });
