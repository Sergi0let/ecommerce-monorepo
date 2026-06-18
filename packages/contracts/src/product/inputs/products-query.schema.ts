import { z } from 'zod';
import { PaginationQuerySchema } from '../../common/pagination.js';
import { SortOrderSchema } from '../../common/sort.js';

export const ProductQuerySchema = PaginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  sort: SortOrderSchema.default('desc'),
});
