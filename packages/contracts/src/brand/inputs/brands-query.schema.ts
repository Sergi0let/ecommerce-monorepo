import { z } from 'zod';
import { SortOrderSchema } from '../../common/sort.js';

export const BrandsQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  sort: SortOrderSchema.default('desc'),
});

export type BrandsQueryType = z.infer<typeof BrandsQuerySchema>;
