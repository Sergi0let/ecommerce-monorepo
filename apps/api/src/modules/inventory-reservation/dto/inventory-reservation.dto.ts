import { InventoryReservationDetailsSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class InventoryReservationDto extends createZodDto(
  InventoryReservationDetailsSchema,
) {}
