import { z } from 'zod';
import { CreateProductImagesSchema } from '../inputs/create-product-images.schema.js';
import { UpdateProductImagesSchema } from '../inputs/update-product-images.schema.js';
import { ProductImageSchema } from '../schemas/product-images.schema.js';
import { UploadProductImageSchema } from '../inputs/upload-product-image.schema.js';

export type ProductImagesType = z.infer<typeof ProductImageSchema>;
export type CreateProductImagesType = z.infer<typeof CreateProductImagesSchema>;
export type UpdateProductImagesType = z.infer<typeof UpdateProductImagesSchema>;
export type UploadProductImageInputType = z.input<
  typeof UploadProductImageSchema
>;
