import { CategorySchema } from './category.schema.js';

export const CategoryListItemSchema = CategorySchema.omit({
  createdAt: true,
  updatedAt: true,
});
