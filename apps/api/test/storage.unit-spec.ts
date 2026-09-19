import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { R2StorageConfigSchema } from '@repo/contracts';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../src/common/storage/object-storage.interface';
import { loadR2StorageConfig } from '../src/common/storage/r2-storage.config';
import { R2StorageService } from '../src/common/storage/r2-storage.service';
import { StorageModule } from '../src/common/storage/storage.module';

const config = {
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_BUCKET: 'market-cosmo-test',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_PUBLIC_BASE_URL: 'https://images.example.com/',
};
const key = 'products/product-id/image-id/large.webp';

describe('R2 configuration', () => {
  it.each(Object.keys(config))('requires %s', (field) => {
    expect(
      R2StorageConfigSchema.safeParse({ ...config, [field]: undefined })
        .success,
    ).toBe(false);
  });

  it.each([
    { R2_PUBLIC_BASE_URL: '' },
    { R2_PUBLIC_BASE_URL: 'not-a-url' },
    { R2_ACCOUNT_ID: 'https://account.example.com' },
    { R2_BUCKET: '../another-bucket' },
    { R2_ACCESS_KEY_ID: ' ' },
    { R2_SECRET_ACCESS_KEY: '' },
    { R2_PUBLIC_BASE_URL: 'http://images.example.com' },
    { R2_PUBLIC_BASE_URL: 'https://user:secret@images.example.com' },
    { R2_PUBLIC_BASE_URL: 'https://images.example.com?token=secret' },
    { R2_PUBLIC_BASE_URL: 'https://images.example.com#fragment' },
  ])('rejects invalid configuration: %j', (override) => {
    expect(
      R2StorageConfigSchema.safeParse({ ...config, ...override }).success,
    ).toBe(false);
  });

  it('reports invalid field names without leaking supplied values', () => {
    const invalid = new ConfigService({
      ...config,
      R2_ACCOUNT_ID: 'private-value',
    });
    expect(() => loadR2StorageConfig(invalid)).toThrow(
      'Invalid R2 configuration: R2_ACCOUNT_ID',
    );
    expect(() => loadR2StorageConfig(invalid)).not.toThrow('private-value');
  });

  it('fails module initialization when configuration is invalid', async () => {
    await expect(
      Test.createTestingModule({ imports: [StorageModule] })
        .overrideProvider(ConfigService)
        .useValue(new ConfigService({ ...config, R2_PUBLIC_BASE_URL: '' }))
        .compile(),
    ).rejects.toThrow('Invalid R2 configuration: R2_PUBLIC_BASE_URL');
  });

  it('configures one R2 client and releases it when the module closes', async () => {
    const module = await Test.createTestingModule({ imports: [StorageModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(config))
      .compile();
    const client = module.get(S3Client);
    const destroy = jest.spyOn(client, 'destroy');
    try {
      expect(await client.config.region()).toBe('auto');
      expect((await client.config.endpoint?.())?.hostname).toBe(
        `${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      );
      expect(await client.config.maxAttempts()).toBe(3);
      expect(module.get(OBJECT_STORAGE)).toBe(module.get(R2StorageService));
      expect(module.get(S3Client)).toBe(client);
    } finally {
      await module.close();
    }
    expect(destroy).toHaveBeenCalledTimes(1);
    destroy.mockRestore();
  });
});

describe('R2 storage adapter', () => {
  let module: TestingModule;
  let storage: ObjectStorage;
  const send =
    jest.fn<
      (
        command:
          | PutObjectCommand
          | DeleteObjectCommand
          | HeadObjectCommand
          | ListObjectsV2Command,
        options: { abortSignal: AbortSignal },
      ) => Promise<unknown>
    >();
  const destroy = jest.fn<() => void>();

  beforeEach(async () => {
    send.mockReset().mockResolvedValue({});
    destroy.mockClear();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    module = await Test.createTestingModule({ imports: [StorageModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(config))
      .overrideProvider(S3Client)
      .useValue({ send, destroy })
      .compile();
    storage = module.get<ObjectStorage>(OBJECT_STORAGE);
  });

  afterEach(async () => {
    await module?.close();
    jest.restoreAllMocks();
  });

  it('reads object metadata without downloading bytes', async () => {
    const lastModified = new Date();
    send.mockResolvedValueOnce({ LastModified: lastModified });
    await expect(storage.headObject(key)).resolves.toEqual({ lastModified });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it.each(['NotFound', 'NoSuchKey'])(
    'recognizes HEAD %s as an absent object',
    async (name) => {
      send.mockRejectedValueOnce(
        new S3ServiceException({
          name,
          message: 'missing',
          $fault: 'client',
          $metadata: { httpStatusCode: 404 },
        }),
      );
      await expect(storage.headObject(key)).resolves.toBeNull();
    },
  );

  it.each([
    { name: 'AccessDenied', status: 403 },
    { name: 'NoSuchBucket', status: 404 },
    { name: 'UnknownError', status: 500 },
  ])(
    'does not interpret $name as a missing object',
    async ({ name, status }) => {
      send.mockRejectedValueOnce(
        new S3ServiceException({
          name,
          message: 'private',
          $fault: 'client',
          $metadata: { httpStatusCode: status },
        }),
      );
      await expect(storage.headObject(key)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('lists one bounded page using the supplied continuation token', async () => {
    const lastModified = new Date();
    send.mockResolvedValueOnce({
      Contents: [{ Key: key, LastModified: lastModified }],
      IsTruncated: true,
      NextContinuationToken: 'next',
    });
    await expect(storage.listObjects('products/', 'cursor')).resolves.toEqual({
      objects: [{ key, lastModified }],
      cursor: 'next',
    });
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(ListObjectsV2Command);
    expect(command?.input).toEqual({
      Bucket: config.R2_BUCKET,
      Prefix: 'products/',
      MaxKeys: 100,
      ContinuationToken: 'cursor',
    });
  });

  it('fails closed when storage pagination or timestamps are incomplete', async () => {
    send.mockResolvedValueOnce({ IsTruncated: true });
    await expect(storage.listObjects('products/')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    send.mockResolvedValueOnce({ Contents: [{ Key: key }] });
    await expect(storage.listObjects('products/')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    send.mockResolvedValueOnce({});
    await expect(storage.headObject(key)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('uploads the supplied bytes and headers and returns the public URL', async () => {
    const body = Buffer.from('processed image');
    const cacheControl = 'public, max-age=31536000, immutable';
    await expect(
      storage.putObject({ key, body, contentType: 'image/webp', cacheControl }),
    ).resolves.toEqual({ key, url: `https://images.example.com/${key}` });
    const [command, options] = send.mock.calls[0]!;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: config.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: cacheControl,
    });
    expect(command.input).not.toHaveProperty('ACL');
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('deletes only the requested key and allows repeated deletion', async () => {
    await storage.deleteObject(key);
    await storage.deleteObject(key);
    expect(send).toHaveBeenCalledTimes(2);
    for (const [command] of send.mock.calls) {
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({ Bucket: config.R2_BUCKET, Key: key });
    }
  });

  it('treats NoSuchKey as deleted but does not hide a missing bucket', async () => {
    const missing = (name: string) =>
      new S3ServiceException({
        name,
        $fault: 'client',
        $metadata: { httpStatusCode: 404 },
      });
    send.mockRejectedValueOnce(missing('NoSuchKey'));
    await expect(storage.deleteObject(key)).resolves.toBeUndefined();
    send.mockRejectedValueOnce(missing('NoSuchBucket'));
    await expect(storage.deleteObject(key)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it.each(['put', 'delete'] as const)(
    'maps %s failures to 503 without leaking SDK errors',
    async (operation) => {
      send.mockRejectedValueOnce(new Error('private credential value'));
      const action =
        operation === 'put'
          ? storage.putObject({
              key,
              body: Buffer.from('image'),
              contentType: 'image/webp',
            })
          : storage.deleteObject(key);
      await expect(action).rejects.toMatchObject({
        status: 503,
        message: 'Object storage is temporarily unavailable',
      });
      expect(Logger.prototype.error).toHaveBeenCalledWith({
        message: 'R2 operation failed',
        operation: operation === 'put' ? 'putObject' : 'deleteObject',
        key,
        statusCode: undefined,
      });
    },
  );

  it.each([
    '',
    '../secret',
    '/products/image.webp',
    'products/../image.webp',
    'products//image.webp',
    'https://other.example/image.webp',
    'products/a?b',
    'products/a%2Fb',
    'products/a\\b',
    'x'.repeat(1025),
  ])(
    'rejects unsafe key case %# before sending a request',
    async (invalidKey) => {
      expect(() => storage.getPublicUrl(invalidKey)).toThrow(TypeError);
      await expect(
        storage.putObject({
          key: invalidKey,
          body: new Uint8Array(),
          contentType: 'image/webp',
        }),
      ).rejects.toBeInstanceOf(TypeError);
      await expect(storage.deleteObject(invalidKey)).rejects.toBeInstanceOf(
        TypeError,
      );
      expect(send).not.toHaveBeenCalled();
    },
  );
});
