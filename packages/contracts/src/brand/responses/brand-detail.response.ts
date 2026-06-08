import { z } from 'zod';
import { CategorySchema } from '../../category/index.js';
import { BrandSchema } from '../schemas/brand.schema.js';

/** GET /brands/:id — brand with categories and product count */
export const BrandDetailSchema = BrandSchema.extend({
  categories: z.array(CategorySchema),
  _count: z.object({
    products: z.number().int(),
  }),
});
