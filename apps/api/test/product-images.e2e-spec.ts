import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  Logger,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  ProductImageSchema,
  UserRole,
  type ProductImagesType,
} from '@repo/contracts';
import { prisma } from '@repo/database';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { IMAGE_PROCESSING_CONFIG } from '../src/common/images/images.config';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
  type PutObjectInput,
} from '../src/common/storage/object-storage.interface';
import { MailService } from '../src/modules/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, PutObjectInput>();
  readonly puts: string[] = [];
  readonly deletes: string[] = [];
  failPutSuffix: string | undefined;
  failDeleteSuffix: string | undefined;
  afterPut: (() => Promise<void>) | undefined;

  getPublicUrl(key: string) {
    return `https://images.example.com/${key}`;
  }

  async putObject(input: PutObjectInput) {
    this.puts.push(input.key);
    this.objects.set(input.key, input);
    await this.afterPut?.();
    // Simulate bytes stored but the acknowledgement lost.
    if (this.failPutSuffix && input.key.endsWith(this.failPutSuffix)) {
      throw new ServiceUnavailableException('Simulated storage upload failure');
    }
    return { key: input.key, url: this.getPublicUrl(input.key) };
  }

  deleteObject(key: string): Promise<void> {
    this.deletes.push(key);
    if (this.failDeleteSuffix && key.endsWith(this.failDeleteSuffix)) {
      return Promise.reject(new Error('Simulated cleanup failure'));
    }
    this.objects.delete(key);
    return Promise.resolve();
  }

  reset() {
    this.objects.clear();
    this.puts.length = 0;
    this.deletes.length = 0;
    this.failPutSuffix = undefined;
    this.failDeleteSuffix = undefined;
    this.afterPut = undefined;
  }
}

describe('Product image multipart integration', () => {
  let app: INestApplication;
  let photo: Buffer;
  const storage = new MemoryStorage();
  const brandId = randomUUID();
  const productId = randomUUID();
  const otherProductId = randomUUID();
  const variantId = randomUUID();
  const otherVariantId = randomUUID();
  const tokens = new Map<UserRole, string>();
  const userIds: number[] = [];
  let failCreate = false;
  const database = prisma.$extends({
    query: {
      productImage: {
        create({ args, query }) {
          if (failCreate) throw new Error('Simulated database insert failure');
          return query(args);
        },
      },
    },
  });

  const token = (role = UserRole.ADMIN) => {
    const value = tokens.get(role);
    if (!value) throw new Error(`Missing token for ${role}`);
    return value;
  };
  const upload = (id: string = productId, role = UserRole.ADMIN) =>
    request(app.getHttpServer())
      .post(`/api/products/${id}/images`)
      .auth(token(role), { type: 'bearer' });
  const update = (id: string, body: object) =>
    request(app.getHttpServer())
      .put(`/api/product-images/id/${id}`)
      .auth(token(), { type: 'bearer' })
      .send(body);
  const createImage = async (
    metadata: Record<string, string> = {},
  ): Promise<ProductImagesType> => {
    let req = upload();
    for (const [key, value] of Object.entries(metadata))
      req = req.field(key, value);
    const response = await req.attach('file', photo, 'photo.jpg').expect(201);
    return ProductImageSchema.parse(response.body);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({})
      .overrideProvider(OBJECT_STORAGE)
      .useValue(storage)
      .overrideProvider(PrismaService)
      .useValue({ client: database })
      .overrideProvider(IMAGE_PROCESSING_CONFIG)
      .useValue({
        IMAGE_MAX_FILE_SIZE_BYTES: 65_536,
        IMAGE_MAX_INPUT_PIXELS: 40_000_000,
        IMAGE_PROCESSING_CONCURRENCY: 2,
      })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    await app.init();

    for (const role of [UserRole.ADMIN, UserRole.MANAGER, UserRole.CUSTOMER]) {
      const user = await prisma.user.create({
        data: { email: `${randomUUID()}@example.com`, role },
      });
      userIds.push(user.id);
      tokens.set(
        role,
        await app.get(JwtService).signAsync(
          { id: user.id, role },
          {
            secret: 'test-access-secret',
            expiresIn: '15m',
          },
        ),
      );
    }
    await prisma.brand.create({
      data: { id: brandId, name: 'Image tests', slug: randomUUID() },
    });
    for (const [id, vid] of [
      [productId, variantId],
      [otherProductId, otherVariantId],
    ]) {
      await prisma.product.create({
        data: {
          id,
          name: 'Image test product',
          slug: randomUUID(),
          brandId,
          variants: {
            create: {
              id: vid,
              slug: randomUUID(),
              sku: randomUUID(),
              isDefault: true,
            },
          },
        },
      });
    }
    photo = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: '#cc5577' },
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(async () => {
    storage.reset();
    failCreate = false;
    await prisma.productImage.deleteMany({ where: { product: { brandId } } });
  });

  afterEach(() => {
    failCreate = false;
  });

  afterAll(async () => {
    try {
      await prisma.product.deleteMany({ where: { brandId } });
      await prisma.brand.deleteMany({ where: { id: brandId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
      await prisma.$disconnect();
    }
  });

  it.each([UserRole.ADMIN, UserRole.MANAGER])(
    'allows %s and creates three WebP objects plus one record',
    async (role) => {
      const response = await upload(productId, role)
        .field('alt', 'Front view')
        .field('sortOrder', '2')
        .field('isPrimary', 'false')
        .attach('file', photo, {
          filename: '../../untrusted.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
      const image = ProductImageSchema.parse(response.body);
      expect(image).toMatchObject({
        productId,
        variantId: null,
        alt: 'Front view',
        sortOrder: 2,
        isPrimary: false,
        width: 1600,
        height: 800,
      });
      expect(image.storageKeyBase).toBe(`products/${productId}/${image.id}`);
      expect(await prisma.productImage.count({ where: { productId } })).toBe(1);
      expect(storage.objects.size).toBe(3);
      expect(storage.puts).toHaveLength(3);
      for (const [name, width] of [
        ['thumbnail', 320],
        ['medium', 960],
        ['large', 1600],
      ] as const) {
        const key = `${image.storageKeyBase}/${name}.webp`;
        const stored = storage.objects.get(key);
        expect(stored).toMatchObject({
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        });
        expect(image[`${name}Url`]).toBe(storage.getPublicUrl(key));
        if (!stored) throw new Error('Missing stored derivative');
        const metadata = await sharp(stored.body).metadata();
        expect(metadata).toMatchObject({
          format: 'webp',
          width,
          height: width / 2,
        });
      }
    },
  );

  it('rejects unauthenticated and customer uploads before writing objects', async () => {
    await request(app.getHttpServer())
      .post(`/api/products/${productId}/images`)
      .attach('file', photo, 'photo.jpg')
      .expect(401);
    await upload(productId, UserRole.CUSTOMER)
      .attach('file', photo, 'photo.jpg')
      .expect(403);
    expect(storage.puts).toHaveLength(0);
  });

  it('rejects unknown products, invalid route IDs and foreign/missing variants', async () => {
    await upload(randomUUID()).attach('file', photo, 'photo.jpg').expect(404);
    await upload('invalid').attach('file', photo, 'photo.jpg').expect(400);
    for (const id of [otherVariantId, randomUUID()]) {
      await upload()
        .field('variantId', id)
        .attach('file', photo, 'photo.jpg')
        .expect(404);
    }
    expect(storage.puts).toHaveLength(0);
  });

  it('requires a file and rejects JSON-only requests', async () => {
    await upload().field('alt', 'Missing file').expect(400);
    await upload().send({ alt: 'JSON metadata' }).expect(400);
    expect(storage.puts).toHaveLength(0);
  });

  it.each([
    'productId',
    'storageKeyBase',
    'thumbnailUrl',
    'mediumUrl',
    'largeUrl',
    'width',
    'height',
  ])('rejects forbidden multipart field %s', async (field) => {
    await upload()
      .field(field, 'client-value')
      .attach('file', photo, 'photo.jpg')
      .expect(400);
    expect(storage.puts).toHaveLength(0);
  });

  it('rejects duplicate and nested metadata instead of coercing it', async () => {
    await upload()
      .field('isPrimary', 'true')
      .field('isPrimary', 'false')
      .attach('file', photo, 'photo.jpg')
      .expect(400);
    await upload()
      .field('alt[value]', 'nested')
      .attach('file', photo, 'photo.jpg')
      .expect(400);
    expect(storage.puts).toHaveLength(0);
  });

  it('accepts all four metadata fields and a file', async () => {
    const image = await createImage({
      alt: 'Variant',
      sortOrder: '3',
      isPrimary: 'false',
      variantId,
    });
    expect(image).toMatchObject({ variantId, sortOrder: 3, isPrimary: false });
  });

  it('enforces file bytes, file count, field count, field size and file field name', async () => {
    await upload()
      .attach('file', Buffer.alloc(65_537), 'large.jpg')
      .expect(413);
    await upload()
      .attach('file', photo, 'a.jpg')
      .attach('file', photo, 'b.jpg')
      .expect(400);
    await upload()
      .field('a', '1')
      .field('b', '2')
      .field('c', '3')
      .field('d', '4')
      .field('e', '5')
      .attach('file', photo, 'photo.jpg')
      .expect(400);
    await upload()
      .field('alt', 'x'.repeat(4097))
      .attach('file', photo, 'photo.jpg')
      .expect(400);
    await upload().attach('wrong', photo, 'photo.jpg').expect(400);
    expect(storage.puts).toHaveLength(0);
  });

  it('rejects corrupted bytes with a valid client MIME', async () => {
    await upload()
      .attach('file', Buffer.from('invalid'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(storage.puts).toHaveLength(0);
  });

  it('cleans partial uploads including an unacknowledged successful PUT', async () => {
    storage.failPutSuffix = '/medium.webp';
    await upload().attach('file', photo, 'photo.jpg').expect(503);
    expect(storage.puts).toHaveLength(2);
    expect(storage.deletes).toHaveLength(3);
    expect(storage.objects.size).toBe(0);
    expect(await prisma.productImage.count({ where: { productId } })).toBe(0);
  });

  it('rolls back primary changes and removes all new objects when DB insertion fails', async () => {
    const original = await createImage({ isPrimary: 'true' });
    failCreate = true;
    await upload()
      .field('isPrimary', 'true')
      .attach('file', photo, 'photo.jpg')
      .expect(500);
    expect(storage.deletes).toHaveLength(3);
    expect(storage.objects.size).toBe(3);
    expect(
      await prisma.productImage.findMany({ where: { productId } }),
    ).toEqual([expect.objectContaining({ id: original.id, isPrimary: true })]);
  });

  it('preserves the upload error and logs orphan keys if compensation fails', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    storage.failPutSuffix = '/medium.webp';
    storage.failDeleteSuffix = '/thumbnail.webp';
    try {
      const response = await upload()
        .attach('file', photo, 'photo.jpg')
        .expect(503);
      expect(response.body.message).toBe('Simulated storage upload failure');
      expect(storage.deletes).toHaveLength(3);
      expect(storage.objects.size).toBe(1);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          keys: [expect.stringContaining('/thumbnail.webp')],
        }),
      );
    } finally {
      log.mockRestore();
    }
  });

  it('rechecks variant ownership after uploads and compensates if it disappeared', async () => {
    const temporary = await prisma.productVariant.create({
      data: { productId, slug: randomUUID(), sku: randomUUID() },
    });
    storage.afterPut = async () => {
      storage.afterPut = undefined;
      await prisma.productVariant.delete({ where: { id: temporary.id } });
    };
    await upload()
      .field('variantId', temporary.id)
      .attach('file', photo, 'photo.jpg')
      .expect(404);
    expect(storage.objects.size).toBe(0);
    expect(await prisma.productImage.count({ where: { productId } })).toBe(0);
  });

  it('serializes simultaneous primary uploads into an empty shared gallery', async () => {
    const images = await Promise.all([
      createImage({ isPrimary: 'true' }),
      createImage({ isPrimary: 'true' }),
    ]);
    expect(images).toHaveLength(2);
    expect(storage.objects.size).toBe(6);
    expect(
      await prisma.productImage.count({
        where: { productId, variantId: null },
      }),
    ).toBe(2);
    expect(
      await prisma.productImage.count({
        where: { productId, variantId: null, isPrimary: true },
      }),
    ).toBe(1);
  });

  it('serializes concurrent primary updates and keeps galleries independent', async () => {
    const first = await createImage();
    const second = await createImage();
    const variantImage = await createImage({ variantId, isPrimary: 'true' });
    await Promise.all([
      update(first.id, { isPrimary: true }).expect(200),
      update(second.id, { isPrimary: true }).expect(200),
    ]);
    expect(
      await prisma.productImage.count({
        where: { productId, variantId: null, isPrimary: true },
      }),
    ).toBe(1);
    expect(
      await prisma.productImage.findUnique({ where: { id: variantImage.id } }),
    ).toMatchObject({ isPrimary: true });
  });

  it('coordinates primary uploads and updates on the same gallery', async () => {
    const existing = await createImage({ variantId });
    await Promise.all([
      createImage({ variantId, isPrimary: 'true' }),
      update(existing.id, { isPrimary: true }).expect(200),
    ]);
    expect(
      await prisma.productImage.count({
        where: { productId, variantId, isPrimary: true },
      }),
    ).toBe(1);
  });

  it('does not undo a primary switch when another request only edits alt', async () => {
    const oldPrimary = await createImage({ isPrimary: 'true' });
    const nextPrimary = await createImage();
    await Promise.all([
      update(nextPrimary.id, { isPrimary: true }).expect(200),
      update(oldPrimary.id, { alt: 'Updated alt' }).expect(200),
    ]);
    expect(
      await prisma.productImage.findUnique({ where: { id: nextPrimary.id } }),
    ).toMatchObject({ isPrimary: true });
    expect(
      await prisma.productImage.findUnique({ where: { id: oldPrimary.id } }),
    ).toMatchObject({ isPrimary: false, alt: 'Updated alt' });
  });

  it('documents multipart, binary file, metadata, authorization and responses', () => {
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .addBearerAuth()
          .addCookieAuth('access_token')
          .build(),
      ),
    );
    const operation = document.paths['/api/products/{productId}/images']?.post;
    expect(operation?.requestBody).toMatchObject({
      content: {
        'multipart/form-data': {
          schema: {
            required: ['file'],
            properties: {
              file: { type: 'string', format: 'binary' },
              isPrimary: { enum: ['true', 'false'] },
            },
          },
        },
      },
    });
    for (const status of ['201', '400', '401', '403', '404', '413', '503'])
      expect(operation?.responses).toHaveProperty(status);
    expect(operation?.responses).not.toHaveProperty('501');
  });
});
