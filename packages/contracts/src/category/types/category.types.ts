import { z } from 'zod';
import { CreateCategorySchema } from '../inputs/create-category.schema.js';
import { UpdateCategorySchema } from '../inputs/update-category.schema.js';
import { CategoryListItemSchema, CategorySchema } from '../schemas/index.js';

export type CategoryType = z.infer<typeof CategorySchema>;
export type CategoryListItemType = z.infer<typeof CategoryListItemSchema>;
export type CreateCategoryType = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryType = z.infer<typeof UpdateCategorySchema>;
