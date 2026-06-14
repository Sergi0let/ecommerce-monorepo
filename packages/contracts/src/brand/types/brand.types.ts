import { z } from 'zod';
import { BrandProductsQuerySchema } from '../inputs/brand-products-query.schema.js';
import { CreateBrandSchema } from '../inputs/create-brand.schema.js';
import { UpdateBrandSchema } from '../inputs/update-brand.schema.js';
import { BrandSummariesResponseSchema } from '../responses/brand-summaries.response.js';
import { BrandSummarySchema } from '../schemas/brand-summary.schema.js';
import { BrandSchema } from '../schemas/brand.schema.js';

export type BrandType = z.infer<typeof BrandSchema>;
export type CreateBrandType = z.infer<typeof CreateBrandSchema>;
export type UpdateBrandType = z.infer<typeof UpdateBrandSchema>;
export type UpdateBrandInputType = z.input<typeof UpdateBrandSchema>;
export type BrandProductsQueryType = z.infer<typeof BrandProductsQuerySchema>;
export type BrandSummaryType = z.infer<typeof BrandSummarySchema>;
export type BrandSummariesPageType = z.infer<
  typeof BrandSummariesResponseSchema
>;
