import { createPaginatedResponseSchema } from '../../common/pagination.js';
import { CategorySummarySchema } from '../schemas/category-summary.schema.js';

export const CategorySummariesResponseSchema = createPaginatedResponseSchema(
  CategorySummarySchema,
);
