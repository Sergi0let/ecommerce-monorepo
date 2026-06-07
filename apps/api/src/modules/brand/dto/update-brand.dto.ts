import { createZodDto } from 'nestjs-zod';
import { UpdateBrandSchema } from '@repo/contracts';

export class UpdateBrandDto extends createZodDto(UpdateBrandSchema) {}
