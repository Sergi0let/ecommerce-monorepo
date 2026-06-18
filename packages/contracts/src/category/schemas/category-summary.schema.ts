import { z } from 'zod';
import { CategorySchema } from './category.schema.js';

export const CategorySummarySchema = CategorySchema.pick({
  id: true,
  name: true,
  slug: true,
  parentId: true,
  metaTitle: true,
  metaDescription: true,
}).extend({
  childrenCount: z.number().int().nonnegative(),
  productsCount: z.number().int().nonnegative(),
});
