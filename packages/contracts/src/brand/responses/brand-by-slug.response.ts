import { z } from 'zod';
import { BrandSchema } from '../schemas/brand.schema.js';
import { ProductWithPricesSchema } from '../../product/index.js';
import { CategorySchema } from '../../category/index.js';

/** GET /brands/slug/:slug — brand with active products and categories */
export const BrandBySlugSchema = BrandSchema.extend({
  products: z.array(ProductWithPricesSchema),
  categories: z.array(CategorySchema),
});
