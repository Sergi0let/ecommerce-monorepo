import { createPaginatedResponseSchema } from '../../common/pagination.js';
import { WarehouseSummarySchema } from './warehouse-summary-schema.js';

export const WarehouseSummaryResponseSchema = createPaginatedResponseSchema(
  WarehouseSummarySchema,
);
