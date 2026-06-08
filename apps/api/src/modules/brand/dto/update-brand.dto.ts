import { UpdateBrandSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateBrandDto extends createZodDto(UpdateBrandSchema) {}
