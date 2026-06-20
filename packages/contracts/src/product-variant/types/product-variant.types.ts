import { z } from 'zod';
import { CreateProductVariantSchema } from '../inputs/create-product-variant.schema.js';
import { UpdateProductVariantSchema } from '../inputs/update-product-variant.schema.js';
import { ProductVariantSchema } from '../schemas/product-variant.schema.js';

export type CreateProductVariantType = z.infer<
  typeof CreateProductVariantSchema
>;

export type UpdateProductVariantType = z.infer<
  typeof UpdateProductVariantSchema
>;

export type ProductVariantType = z.infer<typeof ProductVariantSchema>;
