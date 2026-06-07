import { z } from 'zod';
import {
  UuidSchema,
  SlugSchema,
  TimestampSchema,
} from '../../common/primitives.js';

export const BrandSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: SlugSchema,
  description: z.string().nullable().optional(),
  logo: z.url().nullable().optional(),
  websiteUrl: z.url().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.nullable().optional(),
});
