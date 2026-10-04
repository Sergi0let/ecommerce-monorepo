import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const ReleaseInventoryReservationSchema = z.strictObject({
  reservationId: UuidSchema,
});
