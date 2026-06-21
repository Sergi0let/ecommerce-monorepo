import { z } from 'zod';

import { CreateProductSchema } from '../inputs/create-product.schema.js';
import { ProductCoreSchema } from '../schemas/core.schema.js';
import { ProductImageSchema } from '../schemas/image.schema.js';
import { PriceSchema } from '../schemas/price.schema.js';
import { ProductListItemSchema } from '../views/product-list-item.schema.js';
import { ProductVariantDetailsSchema } from '../views/product-variant-details.schema.js';

export type PriceType = z.infer<typeof PriceSchema>;
export type ProductImageType = z.infer<typeof ProductImageSchema>;
export type ProductCoreType = z.infer<typeof ProductCoreSchema>;
export type ProductVariantDetailsType = z.infer<
  typeof ProductVariantDetailsSchema
>;
export type ProductListItemType = z.infer<typeof ProductListItemSchema>;
export type CreateProductType = z.infer<typeof CreateProductSchema>;
export type CreateProductInputType = z.input<typeof CreateProductSchema>;
