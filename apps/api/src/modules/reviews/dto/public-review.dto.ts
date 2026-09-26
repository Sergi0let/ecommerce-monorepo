import { PublicReviewViewSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class PublicReviewDto extends createZodDto(PublicReviewViewSchema) {}
