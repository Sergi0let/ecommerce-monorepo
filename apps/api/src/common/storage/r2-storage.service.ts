import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ObjectStorageKeySchema,
  type R2StorageConfigType,
} from '@repo/contracts';
import type {
  ObjectStorage,
  PutObjectInput,
  StoredObject,
} from './object-storage.interface';
import { R2_STORAGE_CONFIG } from './r2-storage.config';

@Injectable()
export class R2StorageService implements ObjectStorage, OnModuleDestroy {
  private readonly logger = new Logger(R2StorageService.name);

  constructor(
    @Inject(R2_STORAGE_CONFIG)
    private readonly config: R2StorageConfigType,
    private readonly client: S3Client,
  ) {}

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const url = this.getPublicUrl(input.key);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.R2_BUCKET,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
        }),
        { abortSignal: AbortSignal.timeout(30_000) },
      );
    } catch (error) {
      this.handleStorageError('putObject', input.key, error);
    }

    return { key: input.key, url };
  }

  async deleteObject(key: string): Promise<void> {
    this.assertValidKey(key);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.R2_BUCKET, Key: key }),
        { abortSignal: AbortSignal.timeout(30_000) },
      );
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'NoSuchKey') {
        return;
      }

      this.handleStorageError('deleteObject', key, error);
    }
  }

  getPublicUrl(key: string): string {
    this.assertValidKey(key);
    return `${this.config.R2_PUBLIC_BASE_URL}/${key}`;
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  private assertValidKey(key: string): void {
    if (!ObjectStorageKeySchema.safeParse(key).success) {
      throw new TypeError('Invalid object storage key');
    }
  }

  private handleStorageError(
    operation: string,
    key: string,
    error: unknown,
  ): never {
    this.logger.error({
      message: 'R2 operation failed',
      operation,
      key,
      statusCode:
        error instanceof S3ServiceException
          ? error.$metadata.httpStatusCode
          : undefined,
    });

    throw new ServiceUnavailableException(
      'Object storage is temporarily unavailable',
    );
  }
}
