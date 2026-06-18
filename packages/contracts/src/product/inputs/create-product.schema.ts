import { z } from 'zod';

import { SlugSchema, UuidSchema } from '../../common/primitives.js';

export const CreateProductSchema = z.object({
  name: z.string().min(3),
  slug: SlugSchema,
  description: z.string().nullable().optional(),
  volumeMl: z.number().int().positive().nullable().optional(),
  weightG: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  brandId: UuidSchema,
  categoryId: UuidSchema.nullish(),
  metaTitle: z.string().max(255).nullable().optional(),
  metaDescription: z.string().max(255).nullable().optional(),
});
