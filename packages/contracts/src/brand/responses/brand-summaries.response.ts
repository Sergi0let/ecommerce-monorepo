import { createPaginatedResponseSchema } from '../../common/pagination.js';
import { BrandSummarySchema } from '../schemas/brand-summary.schema.js';

export const BrandSummariesResponseSchema =
  createPaginatedResponseSchema(BrandSummarySchema);
