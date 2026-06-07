import { z } from 'zod';

import { BrandSchema } from './brand.schema.js';

export const BrandWithCountsSchema = BrandSchema.extend({
  _count: z.object({
    products: z.number().int(),
    categories: z.number().int(),
  }),
});
