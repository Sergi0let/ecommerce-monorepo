import { z } from 'zod';

import { UserSchema } from '../schemas/user.schema.js';

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});
