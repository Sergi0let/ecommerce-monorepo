import { z } from 'zod';
import { InventoryReservationItemSchema } from '../schemas/inventory-reservation-item.schema.js';
import { InventoryReservationSchema } from '../schemas/inventory-reservation.schema.js';

export const InventoryReservationDetailsSchema =
  InventoryReservationSchema.extend({
    items: z.array(InventoryReservationItemSchema).min(1),
  });
