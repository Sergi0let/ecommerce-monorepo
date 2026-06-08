import { z } from 'zod';

import { SlugSchema, UuidSchema } from '../../common/primitives.js';
import { ProductCoreSchema } from '../schemas/core.schema.js';

export const CreateProductSchema = ProductCoreSchema.omit({
  id: true,
  deletedAt: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
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
