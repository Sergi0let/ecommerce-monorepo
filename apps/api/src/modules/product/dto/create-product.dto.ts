import { CreateProductSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
