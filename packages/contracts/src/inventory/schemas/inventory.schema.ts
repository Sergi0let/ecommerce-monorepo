import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const InventorySchema = z.object({
  id: UuidSchema,
  variantId: UuidSchema,
  warehouseId: UuidSchema,
  quantity: z.number().int(),
  reserved: z.number().int(),
  incoming: z.number().int(),
  location: z.string().nullable(),
  batchNumber: z.string().nullable(),
  expiresAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema,
  lastCountedAt: TimestampSchema.nullable(),
});
