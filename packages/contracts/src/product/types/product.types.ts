import { z } from 'zod';

import { BrandProductsResponseSchema } from '../responses/brand-products.response.js';
import { ProductCoreSchema } from '../schemas/core.schema.js';
import { ProductImageSchema } from '../schemas/image.schema.js';
import { PriceSchema } from '../schemas/price.schema.js';
import { ProductListItemSchema } from '../views/product-list-item.schema.js';
import { ProductWithPricesSchema } from '../views/product-with-prices.schema.js';

export type PriceType = z.infer<typeof PriceSchema>;
export type ProductImageType = z.infer<typeof ProductImageSchema>;
export type ProductCoreType = z.infer<typeof ProductCoreSchema>;
export type ProductWithPricesType = z.infer<typeof ProductWithPricesSchema>;
export type ProductListItemType = z.infer<typeof ProductListItemSchema>;
export type BrandProductsPageType = z.infer<typeof BrandProductsResponseSchema>;
