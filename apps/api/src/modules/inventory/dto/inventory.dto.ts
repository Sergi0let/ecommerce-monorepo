import { InventorySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class InventoryDto extends createZodDto(InventorySchema) {}
