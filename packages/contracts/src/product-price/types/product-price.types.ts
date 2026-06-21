import { z } from 'zod';
import { CreateProductPriceSchema } from '../inputs/create-product-price.schema.js';
import { UpdateProductPriceSchema } from '../inputs/update-product-price.schema.js';
import { ProductPriceSchema } from '../schemas/product-price.schema.js';

export type CreateProductPriceType = z.infer<typeof CreateProductPriceSchema>;
export type UpdateProductPriceType = z.infer<typeof UpdateProductPriceSchema>;
export type ProductPriceType = z.infer<typeof ProductPriceSchema>;
