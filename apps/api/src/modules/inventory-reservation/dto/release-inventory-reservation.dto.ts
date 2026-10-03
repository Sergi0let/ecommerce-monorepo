import { ReleaseInventoryReservationSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ReleaseInventoryReservationDto extends createZodDto(
  ReleaseInventoryReservationSchema,
) {}
