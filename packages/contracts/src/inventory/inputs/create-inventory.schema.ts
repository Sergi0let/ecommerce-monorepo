import { z } from 'zod';

import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const InventoryValuesInputSchema = z.object({
  quantity: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  incoming: z.number().int().nonnegative(),
  location: z.string().trim().min(1).max(120).nullable().optional(),
  batchNumber: z.string().trim().min(1).max(100).nullable().optional(),
  expiresAt: TimestampSchema.nullable().optional(),
  lastCountedAt: TimestampSchema.nullable().optional(),
});

export const CreateInventorySchema = InventoryValuesInputSchema.extend({
  variantId: UuidSchema,
  warehouseId: UuidSchema,
  quantity: z.number().int().nonnegative().default(0),
  reserved: z.number().int().nonnegative().default(0),
  incoming: z.number().int().nonnegative().default(0),
}).refine((data) => data.reserved <= data.quantity, {
  path: ['reserved'],
  message: 'reserved must be less than or equal to quantity',
});
