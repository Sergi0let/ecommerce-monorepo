import { z } from 'zod';
import { BrandSchema } from './brand.schema.js';

export const BrandSummarySchema = BrandSchema.pick({
  id: true,
  name: true,
  slug: true,
  logo: true,
  isActive: true,
}).extend({
  categoriesCount: z.number().int().nonnegative(),
  productsCount: z.number().int().nonnegative(),
});
