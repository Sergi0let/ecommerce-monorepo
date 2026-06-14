import { createPaginatedResponseSchema } from '../../common/pagination.js';
import { ProductListItemSchema } from '../../product/views/product-list-item.schema.js';

export const BrandProductsResponseSchema = createPaginatedResponseSchema(
  ProductListItemSchema,
);
