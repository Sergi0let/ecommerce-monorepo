import { CreateReviewSchema } from './create-review.schema.js';

export const UpdateReviewSchema = CreateReviewSchema.pick({
  rating: true,
  comment: true,
})
  .partial()
  .strict();
