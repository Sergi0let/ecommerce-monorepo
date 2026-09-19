import { ProductImageInputBaseSchema } from './create-product-images.schema.js';

export const UpdateProductImagesSchema = ProductImageInputBaseSchema.pick({
  alt: true,
  sortOrder: true,
  isPrimary: true,
}).partial();
