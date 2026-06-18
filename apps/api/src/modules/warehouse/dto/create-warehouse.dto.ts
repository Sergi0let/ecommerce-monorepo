import { CreateWarehouseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateWarehouseDto extends createZodDto(CreateWarehouseSchema) {}
