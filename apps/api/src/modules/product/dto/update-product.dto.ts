import { UpdateProductSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
