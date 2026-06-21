import { z } from 'zod';

import { ProductVariantSchema } from '../../product-variant/index.js';
import { ProductImageSchema, PriceSchema } from '../schemas/index.js';

export const ProductVariantDetailsSchema = ProductVariantSchema.extend({
  prices: z.array(PriceSchema),
  images: z.array(ProductImageSchema),
});
