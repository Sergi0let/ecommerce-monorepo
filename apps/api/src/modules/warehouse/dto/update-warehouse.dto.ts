import { UpdateWarehouseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateWarehouseDto extends createZodDto(UpdateWarehouseSchema) {}
