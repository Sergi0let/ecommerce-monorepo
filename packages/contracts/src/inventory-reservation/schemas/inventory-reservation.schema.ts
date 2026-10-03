import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const InventoryReservationStatusSchema = z.enum([
  'ACTIVE',
  'RELEASED',
  'CONSUMED',
  'EXPIRED',
]);

export const InventoryReservationSchema = z.object({
  id: UuidSchema,
  status: InventoryReservationStatusSchema,
  idempotencyKey: z.string(),
  expiresAt: TimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
