import { z } from 'zod';
import { ConsumeInventoryReservationSchema } from '../inputs/consume-inventory-reservation.schema.js';
import { ReleaseInventoryReservationSchema } from '../inputs/release-inventory-reservation.schema.js';
import {
  ReserveInventoryItemSchema,
  ReserveInventorySchema,
} from '../inputs/reserve-inventory.schema.js';
import { InventoryReservationItemSchema } from '../schemas/inventory-reservation-item.schema.js';
import {
  InventoryReservationSchema,
  InventoryReservationStatusSchema,
} from '../schemas/inventory-reservation.schema.js';
import { InventoryReservationDetailsSchema } from '../views/inventory-reservation-details.schema.js';

export type InventoryReservationStatusType = z.infer<
  typeof InventoryReservationStatusSchema
>;
export type InventoryReservationItemType = z.infer<
  typeof InventoryReservationItemSchema
>;
export type InventoryReservationType = z.infer<
  typeof InventoryReservationSchema
>;
export type InventoryReservationDetailsType = z.infer<
  typeof InventoryReservationDetailsSchema
>;
export type ReserveInventoryItemType = z.infer<
  typeof ReserveInventoryItemSchema
>;
export type ReserveInventoryType = z.infer<typeof ReserveInventorySchema>;
export type ReserveInventoryInputType = z.input<typeof ReserveInventorySchema>;
export type ReleaseInventoryReservationType = z.infer<
  typeof ReleaseInventoryReservationSchema
>;
export type ReleaseInventoryReservationInputType = z.input<
  typeof ReleaseInventoryReservationSchema
>;
export type ConsumeInventoryReservationType = z.infer<
  typeof ConsumeInventoryReservationSchema
>;
export type ConsumeInventoryReservationInputType = z.input<
  typeof ConsumeInventoryReservationSchema
>;
