import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const WarehouseSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  code: z.string(),
  address: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
