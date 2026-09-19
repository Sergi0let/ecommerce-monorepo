import { ConfigService } from '@nestjs/config';
import {
  R2StorageConfigSchema,
  type R2StorageConfigType,
} from '@repo/contracts';

export const R2_STORAGE_CONFIG = Symbol('R2_STORAGE_CONFIG');

export function loadR2StorageConfig(
  config: ConfigService,
): R2StorageConfigType {
  const result = R2StorageConfigSchema.safeParse({
    R2_ACCOUNT_ID: config.get<unknown>('R2_ACCOUNT_ID'),
    R2_BUCKET: config.get<unknown>('R2_BUCKET'),
    R2_ACCESS_KEY_ID: config.get<unknown>('R2_ACCESS_KEY_ID'),
    R2_SECRET_ACCESS_KEY: config.get<unknown>('R2_SECRET_ACCESS_KEY'),
    R2_PUBLIC_BASE_URL: config.get<unknown>('R2_PUBLIC_BASE_URL'),
  });

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    // Report field names only: Zod errors may include configuration values.
    throw new Error(`Invalid R2 configuration: ${fields.join(', ')}`);
  }

  return result.data;
}
