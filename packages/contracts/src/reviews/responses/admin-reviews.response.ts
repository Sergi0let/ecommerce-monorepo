import { createPaginatedResponseSchema } from '../../common/pagination.js';
import { ReviewSchema } from '../schemas/reviews.schema.js';

export const AdminReviewsResponseSchema =
  createPaginatedResponseSchema(ReviewSchema);
