import { z } from 'zod';

export const R2StorageConfigSchema = z.object({
  R2_ACCOUNT_ID: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/i),
  R2_BUCKET: z
    .string()
    .trim()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  R2_ACCESS_KEY_ID: z.string().trim().min(1),
  R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
  R2_PUBLIC_BASE_URL: z
    .url({ protocol: /^https$/ })
    .pipe(
      z.string().refine((value) => {
        const url = new URL(value);
        return !url.username && !url.password && !url.search && !url.hash;
      }),
    )
    .transform((value) => value.replace(/\/+$/, '')),
});

// Server-generated ASCII paths; reject URL syntax and traversal segments.
export const ObjectStorageKeySchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*(\/[a-zA-Z0-9_-][a-zA-Z0-9._-]*)*$/);

export type R2StorageConfigType = z.infer<typeof R2StorageConfigSchema>;
