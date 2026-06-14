import { z } from 'zod';
import { CategoriesQuerySchema } from '../inputs/categories-query.schema.js';
import { CategoryProductsQuerySchema } from '../inputs/category-products-query.schema.js';
import { CreateCategorySchema } from '../inputs/create-category.schema.js';
import { UpdateCategorySchema } from '../inputs/update-category.schema.js';
import {
  CategoryProductsResponseSchema,
  CategorySummariesResponseSchema,
} from '../responses/index.js';
import { CategorySchema, CategorySummarySchema } from '../schemas/index.js';

export type CategoryType = z.infer<typeof CategorySchema>;
export type CategorySummaryType = z.infer<typeof CategorySummarySchema>;
export type CategorySummariesPageType = z.infer<
  typeof CategorySummariesResponseSchema
>;
export type CategoryProductsPageType = z.infer<
  typeof CategoryProductsResponseSchema
>;
export type CategoriesQueryType = z.infer<typeof CategoriesQuerySchema>;
export type CreateCategoryType = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryType = z.infer<typeof UpdateCategorySchema>;
export type CategoryProductsQueryType = z.infer<
  typeof CategoryProductsQuerySchema
>;
