import { z } from 'zod';

import { SlugSchema, UuidSchema } from '../../common/primitives.js';

export const CreateCategorySchema = z.object({
  name: z.string().min(3),
  slug: SlugSchema,
  parentId: UuidSchema.nullish(),
  brandId: UuidSchema,
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(255).optional(),
});
