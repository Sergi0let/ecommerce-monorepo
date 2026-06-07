import { BrandBySlugSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandBySlugDto extends createZodDto(BrandBySlugSchema) {}
