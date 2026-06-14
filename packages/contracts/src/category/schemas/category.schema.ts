import { z } from 'zod';

import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const CategorySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: z.string(),
  parentId: UuidSchema.nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.nullable(),
});
