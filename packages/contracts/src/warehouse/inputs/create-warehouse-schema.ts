import { z } from 'zod';

export const CreateWarehouseSchema = z.object({
  name: z.string().trim().min(3).max(80),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/)
    .transform((value) => value.toUpperCase()),
  address: z.string().trim().min(6).max(120).optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
