import { createPaginatedResponseSchema } from '../../common/pagination.js';
import { PublicReviewViewSchema } from '../views/review-public.view.js';

export const PublicReviewsResponseSchema = createPaginatedResponseSchema(
  PublicReviewViewSchema,
);
