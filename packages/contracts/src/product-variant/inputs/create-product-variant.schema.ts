import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const CreateProductVariantSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(3).nullable().optional(),
  volumeMl: z.number().int().positive().nullable().optional(),
  weightG: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  productId: UuidSchema,
});
