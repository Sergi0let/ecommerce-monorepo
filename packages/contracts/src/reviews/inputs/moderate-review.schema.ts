import { z } from 'zod';

export const ModerateReviewSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
  })
  .strict();
