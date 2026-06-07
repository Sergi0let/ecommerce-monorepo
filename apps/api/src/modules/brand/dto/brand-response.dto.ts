import { BrandSchema, BrandWithCountsSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandResponseDto extends createZodDto(BrandSchema) {}

export class BrandWithCountsDto extends createZodDto(BrandWithCountsSchema) {}
