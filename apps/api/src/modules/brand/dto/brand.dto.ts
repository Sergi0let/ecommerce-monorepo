import { BrandSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandDto extends createZodDto(BrandSchema) {}
