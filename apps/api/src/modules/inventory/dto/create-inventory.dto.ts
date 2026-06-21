import { CreateInventorySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateInventoryDto extends createZodDto(CreateInventorySchema) {}
