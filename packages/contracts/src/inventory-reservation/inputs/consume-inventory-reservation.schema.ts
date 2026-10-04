import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const ConsumeInventoryReservationSchema = z.strictObject({
  reservationId: UuidSchema,
});
