import { z } from 'zod';
import { SlugSchema } from '../../common/primitives.js';

export const IngredientInputBaseSchema = z.object({
  name: z.string().min(3, 'Назва має містити щонайменше 3 символи'),
  slug: SlugSchema,
  inciName: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  comedogenicRating: z.number().int().min(0).max(5).nullable().optional(),
  safetyScore: z.number().min(0).max(10).nullable().optional(),
  isAllergen: z.boolean(),
  isPreservative: z.boolean(),
  isFragrance: z.boolean(),
  benefits: z.array(z.string()),
  restrictions: z.array(z.string()),
});

export const IngredientInputSchema = IngredientInputBaseSchema.extend({
  comedogenicRating: z.number().int().min(0).max(5).nullable().default(0),
  isAllergen: z.boolean().default(false),
  isPreservative: z.boolean().default(false),
  isFragrance: z.boolean().default(false),
  benefits: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
});

export const CreateIngredientSchema = IngredientInputSchema;
