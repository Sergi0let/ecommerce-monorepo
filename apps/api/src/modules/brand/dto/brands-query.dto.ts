import { BrandsQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandsQueryDto extends createZodDto(BrandsQuerySchema) {}
