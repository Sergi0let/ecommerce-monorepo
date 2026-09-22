import { z } from 'zod';
import { CreateReviewSchema } from '../inputs/create-review.schema.js';
import { UpdateReviewSchema } from '../inputs/update-review.schema.js';
import { ReviewSchema } from '../schemas/reviews.schema.js';

export type CreateReviewType = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewType = z.infer<typeof UpdateReviewSchema>;
export type ReviewType = z.infer<typeof ReviewSchema>;
