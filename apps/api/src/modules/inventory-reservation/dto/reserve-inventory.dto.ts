import { ReserveInventorySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ReserveInventoryDto extends createZodDto(ReserveInventorySchema) {}
