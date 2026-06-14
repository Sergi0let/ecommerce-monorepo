import { z } from 'zod';
import { SlugSchema } from '../../common/primitives.js';

export const CreateBrandSchema = z.object({
  name: z.string().min(3),
  slug: SlugSchema,
  description: z.string().max(500).optional(),
  logo: z.url().optional(),
  websiteUrl: z.url().optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
});
