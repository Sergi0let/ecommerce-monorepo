import { z } from 'zod';
import {
  CreateIngredientSchema,
  IngredientInputSchema,
} from '../inputs/create-ingredient.schema.js';
import { UpdateIngredientSchema } from '../inputs/update-ingredient.schema.js';
import { IngredientSchema } from '../schemas/ingredient.schema.js';

export type IngredientType = z.infer<typeof IngredientSchema>;
export type IngredientInputType = z.input<typeof IngredientInputSchema>;
export type CreateIngredientType = z.infer<typeof CreateIngredientSchema>;
export type UpdateIngredientInputType = z.input<typeof UpdateIngredientSchema>;
export type UpdateIngredientType = z.infer<typeof UpdateIngredientSchema>;
