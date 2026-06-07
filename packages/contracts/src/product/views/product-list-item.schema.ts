import { z } from 'zod';

import { ProductImageSchema } from '../schemas/index.js';
import { ProductWithPricesSchema } from './product-with-prices.schema.js';

/** Paginated product list — prices + images */
export const ProductListItemSchema = ProductWithPricesSchema.extend({
  images: z.array(ProductImageSchema),
});
