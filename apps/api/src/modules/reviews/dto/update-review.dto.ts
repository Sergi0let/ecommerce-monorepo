import { UpdateReviewSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateReviewDto extends createZodDto(UpdateReviewSchema) {}
