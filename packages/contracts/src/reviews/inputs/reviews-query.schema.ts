import { z } from 'zod';
import { PaginationQuerySchema } from '../../common/pagination.js';
import { UuidSchema } from '../../common/primitives.js';
import { ReviewStatusSchema } from '../schemas/reviews.schema.js';

export const PublicReviewsQuerySchema = PaginationQuerySchema.extend({
  productId: UuidSchema.optional(),
});

export const AdminReviewsQuerySchema = PaginationQuerySchema.extend({
  productId: UuidSchema.optional(),
  status: ReviewStatusSchema.optional(),
});

export type PublicReviewsQueryInputType = z.input<
  typeof PublicReviewsQuerySchema
>;
export type AdminReviewsQueryInputType = z.input<
  typeof AdminReviewsQuerySchema
>;
