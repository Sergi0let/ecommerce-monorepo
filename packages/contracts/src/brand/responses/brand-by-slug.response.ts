import { z } from 'zod';
import { CategorySchema } from '../../category/index.js';
import { ProductWithPricesSchema } from '../../product/index.js';
import { BrandSchema } from '../schemas/brand.schema.js';

/** GET /brands/slug/:slug — brand with active products and categories */
export const BrandBySlugSchema = BrandSchema.extend({
  products: z.array(ProductWithPricesSchema),
  categories: z.array(CategorySchema),
});
