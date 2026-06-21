import { z } from 'zod';

import { ProductImageSchema } from '../../product-images/index.js';
import { ProductCoreSchema } from '../schemas/index.js';
import { ProductVariantDetailsSchema } from './product-variant-details.schema.js';

/** Product aggregate used by product detail and catalog endpoints. */
export const ProductListItemSchema = ProductCoreSchema.extend({
  images: z.array(ProductImageSchema),
  variants: z.array(ProductVariantDetailsSchema),
});
