import { z } from 'zod';
import { CategorySchema } from '../schemas/index.js';

export type CategoryType = z.infer<typeof CategorySchema>;
