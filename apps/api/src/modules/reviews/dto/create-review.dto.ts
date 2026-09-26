import { CreateReviewSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateReviewDto extends createZodDto(CreateReviewSchema) {}
