import { BrandDetailSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandDetailDto extends createZodDto(BrandDetailSchema) {}
