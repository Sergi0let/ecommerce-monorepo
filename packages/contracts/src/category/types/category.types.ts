import { z } from 'zod';
import { CategorySchema } from '../schemas/index.js';
import { CreateCategorySchema } from '../inputs/create-category.schema.js';
import { UpdateCategorySchema } from '../inputs/update-category.schema.js';

export type CategoryType = z.infer<typeof CategorySchema>;
export type CreateCategoryType = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryType = z.infer<typeof UpdateCategorySchema>;
