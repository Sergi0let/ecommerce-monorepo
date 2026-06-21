import { UpdateInventorySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateInventoryDto extends createZodDto(UpdateInventorySchema) {}
