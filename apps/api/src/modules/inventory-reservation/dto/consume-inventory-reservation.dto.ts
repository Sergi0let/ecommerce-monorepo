import { ConsumeInventoryReservationSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ConsumeInventoryReservationDto extends createZodDto(
  ConsumeInventoryReservationSchema,
) {}
