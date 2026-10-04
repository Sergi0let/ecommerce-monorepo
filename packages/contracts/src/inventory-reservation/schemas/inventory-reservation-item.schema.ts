import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const InventoryReservationItemSchema = z.object({
  id: UuidSchema,
  reservationId: UuidSchema,
  inventoryId: UuidSchema,
  quantity: z.number().int().positive(),
});
