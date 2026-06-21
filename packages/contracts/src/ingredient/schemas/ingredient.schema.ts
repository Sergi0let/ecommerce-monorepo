import { z } from 'zod';
import {
  SlugSchema,
  TimestampSchema,
  UuidSchema,
} from '../../common/primitives.js';

export const IngredientSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: SlugSchema,
  inciName: z.string().nullable(),
  description: z.string().nullable(),
  comedogenicRating: z.number().int().min(0).max(5).nullable(),
  safetyScore: z.number().min(0).max(10).nullable(),
  isAllergen: z.boolean(),
  isPreservative: z.boolean(),
  isFragrance: z.boolean(),
  benefits: z.array(z.string()),
  restrictions: z.array(z.string()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
