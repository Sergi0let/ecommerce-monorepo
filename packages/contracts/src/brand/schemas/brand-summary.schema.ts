import { BrandSchema } from './brand.schema.js';

export const BrandSummarySchema = BrandSchema.pick({
  id: true,
  name: true,
  slug: true,
  logo: true,
  isActive: true,
});
