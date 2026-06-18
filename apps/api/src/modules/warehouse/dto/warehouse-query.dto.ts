import { WarehouseQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class WarehouseQueryDto extends createZodDto(WarehouseQuerySchema) {}
