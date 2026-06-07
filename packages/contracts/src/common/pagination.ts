import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type PaginationQueryType = z.infer<typeof PaginationQuerySchema>;

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  });
}

export type PaginatedResponseType<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
