import { z } from 'zod';
import { CategorySchema } from '../../category/index.js';
import { BrandSchema } from '../schemas/brand.schema.js';

export const BrandDetailSchema = BrandSchema.extend({
  categories: z.array(CategorySchema),
  _count: z.object({
    products: z.number().int(),
  }),
});
