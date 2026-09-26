import { ReviewSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ReviewDto extends createZodDto(ReviewSchema) {}
