import { z } from 'zod';
import { SortOrderSchema } from '../../common/sort.js';

export const CategoriesQuerySchema = z.object({
  sort: SortOrderSchema.default('desc'),
});
