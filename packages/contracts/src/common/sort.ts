import { z } from 'zod';

export const SortOrderSchema = z.enum(['asc', 'desc']);

export type SortOrderType = z.infer<typeof SortOrderSchema>;
