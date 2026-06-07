import { z } from 'zod';

import { SlugSchema, UuidSchema } from '../../common/primitives.js';

export const CreateCategorySchema = z.object({
  name: z.string().min(3),
  slug: SlugSchema,
  parentId: UuidSchema.nullable(),
  brandId: UuidSchema,
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
});
