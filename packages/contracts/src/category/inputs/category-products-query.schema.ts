import { PaginationQuerySchema } from '../../common/pagination.js';
import { CategoriesQuerySchema } from './categories-query.schema.js';

export const CategoryProductsQuerySchema = PaginationQuerySchema.extend(
  CategoriesQuerySchema.shape,
);
