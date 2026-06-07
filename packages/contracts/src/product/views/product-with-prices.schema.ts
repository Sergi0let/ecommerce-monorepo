import { z } from 'zod';
import { PriceSchema } from '../schemas/price.schema.js';
import { ProductCoreSchema } from '../schemas/core.schema.js';

/** Active products on brand slug page — prices only, no images */
export const ProductWithPricesSchema = ProductCoreSchema.extend({
  prices: z.array(PriceSchema),
});
