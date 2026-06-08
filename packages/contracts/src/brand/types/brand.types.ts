import { z } from 'zod';
import { CreateBrandSchema } from '../inputs/create-brand.schema.js';
import { UpdateBrandSchema } from '../inputs/update-brand.schema.js';
import { BrandBySlugSchema } from '../responses/brand-by-slug.response.js';
import { BrandDetailSchema } from '../responses/brand-detail.response.js';
import { BrandSummarySchema } from '../schemas/brand-summary.schema.js';
import { BrandWithCountsSchema } from '../schemas/brand-with-counts.schema.js';
import { BrandSchema } from '../schemas/brand.schema.js';

export type CreateBrandType = z.infer<typeof CreateBrandSchema>;
export type CreateBrandInputType = z.input<typeof CreateBrandSchema>;
export type UpdateBrandType = z.infer<typeof UpdateBrandSchema>;
export type UpdateBrandInputType = z.input<typeof UpdateBrandSchema>;
export type BrandType = z.infer<typeof BrandSchema>;
export type BrandWithCountsType = z.infer<typeof BrandWithCountsSchema>;
export type BrandSummaryType = z.infer<typeof BrandSummarySchema>;
export type BrandDetailType = z.infer<typeof BrandDetailSchema>;
export type BrandBySlugType = z.infer<typeof BrandBySlugSchema>;
