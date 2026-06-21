import { z } from 'zod';

import { ProductImageSchema } from '../../product-images/index.js';
import { ProductVariantSchema } from '../../product-variant/index.js';
import { PriceSchema } from '../schemas/index.js';

export const ProductVariantDetailsSchema = ProductVariantSchema.extend({
  prices: z.array(PriceSchema),
  images: z.array(ProductImageSchema),
});
