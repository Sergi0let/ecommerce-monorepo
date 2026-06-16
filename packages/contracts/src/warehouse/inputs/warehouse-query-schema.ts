import { z } from 'zod';
import { PaginationQuerySchema } from '../../common/pagination.js';
import { SortOrderSchema } from '../../common/sort.js';

export const WarehouseQuerySchema = PaginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  isDefault: z.coerce.boolean().optional(),
  sort: SortOrderSchema.default('desc'),
});
