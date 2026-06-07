import { BrandSummarySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class BrandSummaryDto extends createZodDto(BrandSummarySchema) {}
