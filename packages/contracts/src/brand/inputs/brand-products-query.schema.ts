import { PaginationQuerySchema } from '../../common/pagination.js';
import { BrandsQuerySchema } from './brands-query.schema.js';

export const BrandProductsQuerySchema = PaginationQuerySchema.extend(
  BrandsQuerySchema.shape,
);
