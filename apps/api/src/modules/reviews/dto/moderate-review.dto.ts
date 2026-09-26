import { ModerateReviewSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ModerateReviewDto extends createZodDto(ModerateReviewSchema) {}
