import { CreateProductSchema } from './create-product.schema.js';

export const UpdateProductSchema = CreateProductSchema.partial();
