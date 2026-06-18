import { WarehouseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class WarehouseDto extends createZodDto(WarehouseSchema) {}
