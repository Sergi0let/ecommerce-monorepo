import { CreateBrandSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateBrandDto extends createZodDto(CreateBrandSchema) {}
