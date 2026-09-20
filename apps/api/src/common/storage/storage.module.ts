import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { R2StorageConfigType } from '@repo/contracts';
import { OBJECT_STORAGE } from './object-storage.interface';
import { loadR2StorageConfig, R2_STORAGE_CONFIG } from './r2-storage.config';
import { R2StorageService } from './r2-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: R2_STORAGE_CONFIG,
      inject: [ConfigService],
      useFactory: loadR2StorageConfig,
    },
    {
      provide: S3Client,
      inject: [R2_STORAGE_CONFIG],
      useFactory: (config: R2StorageConfigType) =>
        new S3Client({
          region: 'auto',
          endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: config.R2_ACCESS_KEY_ID,
            secretAccessKey: config.R2_SECRET_ACCESS_KEY,
          },
          maxAttempts: 3,
          requestHandler: {
            connectionTimeout: 5_000,
            requestTimeout: 30_000,
            throwOnRequestTimeout: true,
          },
        }),
    },
    R2StorageService,
    { provide: OBJECT_STORAGE, useExisting: R2StorageService },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
