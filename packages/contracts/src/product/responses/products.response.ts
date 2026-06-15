import { createPaginatedResponseSchema } from '../../common/pagination.js';
import { ProductListItemSchema } from '../views/product-list-item.schema.js';

export const ProductsResponseSchema = createPaginatedResponseSchema(
  ProductListItemSchema,
);
