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
import {
  ImageRecoveryService,
  type RecoveryEvent,
} from '../src/modules/product-images/image-recovery.service';
import { ImageCleanupService } from '../src/modules/product-images/image-cleanup.service';

class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, PutObjectInput>();
  readonly modifiedAt = new Map<string, Date>();
  failHead = false;
  failDeleteCount = 0;
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
    this.modifiedAt.set(input.key, new Date());
    await this.afterPut?.();
    // Simulate bytes stored but the acknowledgement lost.
    if (this.failPutSuffix && input.key.endsWith(this.failPutSuffix)) {
      throw new ServiceUnavailableException('Simulated storage upload failure');
    }
    return { key: input.key, url: this.getPublicUrl(input.key) };
  }

  deleteObject(key: string): Promise<void> {
    this.deletes.push(key);
    if (
      this.failDeleteCount-- > 0 ||
      (this.failDeleteSuffix && key.endsWith(this.failDeleteSuffix))
    ) {
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
    this.modifiedAt.clear();
    this.failHead = false;
    this.failDeleteCount = 0;
  }

  headObject(key: string) {
    if (this.failHead)
      return Promise.reject(
        new ServiceUnavailableException('Storage unavailable'),
      );
    return Promise.resolve(
      this.objects.has(key)
        ? { lastModified: this.modifiedAt.get(key) ?? new Date() }
        : null,
    );
  }

  listObjects(prefix: string, cursor?: string) {
    const all = [...this.objects.keys()]
      .sort()
      .filter((key) => key.startsWith(prefix) && (!cursor || key > cursor));
    const keys = all.slice(0, 2);
    return Promise.resolve({
      objects: keys.map((key) => ({
        key,
        lastModified: this.modifiedAt.get(key) ?? new Date(),
      })),
      cursor: all.length > 2 ? keys.at(-1) : undefined,
    });
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
  let failDelete = false;
  let failTaskAck = false;
  const database = prisma.$extends({
    query: {
      productImage: {
        delete({ args, query }) {
          if (failDelete) throw new Error('Simulated database delete failure');
          return query(args);
        },
        create({ args, query }) {
          if (failCreate) throw new Error('Simulated database insert failure');
          return query(args);
        },
      },
      imageCleanupTask: {
        deleteMany({ args, query }) {
          if (failTaskAck)
            throw new Error('Simulated cleanup acknowledgement failure');
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
    failDelete = false;
    failTaskAck = false;
    await prisma.productImage.deleteMany({ where: { product: { brandId } } });
    await prisma.imageCleanupTask.deleteMany({
      where: { productId: { in: [productId, otherProductId] } },
    });
  });

  afterEach(() => {
    failCreate = false;
  });

  afterAll(async () => {
    try {
      await prisma.product.deleteMany({ where: { brandId } });
      await prisma.brand.deleteMany({ where: { id: brandId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.imageCleanupTask.deleteMany({
        where: { productId: { in: [productId, otherProductId] } },
      });
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
      expect(storage.deletes).toHaveLength(5);
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

  const remove = (path: string) =>
    request(app.getHttpServer())
      .delete(`/api/${path}`)
      .auth(token(), { type: 'bearer' });
  const recover = async (apply = false, removeBrokenRecords = false) => {
    const events: RecoveryEvent[] = [];
    const result = await app
      .get(ImageRecoveryService)
      .run({ apply, removeBrokenRecords, graceHours: 1 }, (event) =>
        events.push(event),
      );
    return { ...result, events };
  };
  const old = new Date(Date.now() - 2 * 3600_000);
  const addOrphan = (
    key = `products/${productId}/${randomUUID()}/large.webp`,
    lastModified = old,
  ) => {
    storage.objects.set(key, { key, body: photo, contentType: 'image/webp' });
    storage.modifiedAt.set(key, lastModified);
    return key;
  };

  it('deletes only the requested image and supports repeated DELETE', async () => {
    const image = await createImage();
    const neighbor = await createImage({ variantId });
    await remove(`product-images/${image.id}`).expect(204);
    await remove(`product-images/${image.id}`).expect(204);
    expect(storage.objects.size).toBe(3);
    expect(
      [...storage.objects.keys()].every((key) =>
        key.startsWith(neighbor.storageKeyBase),
      ),
    ).toBe(true);
    expect(
      await prisma.imageCleanupTask.count({ where: { imageId: image.id } }),
    ).toBe(0);
  });

  it('persists failed cleanup and completes it on a repeated DELETE', async () => {
    const image = await createImage();
    storage.failDeleteSuffix = '/medium.webp';
    await remove(`product-images/${image.id}`).expect(503);
    expect(
      await prisma.productImage.findUnique({ where: { id: image.id } }),
    ).toBeNull();
    expect(storage.objects.size).toBe(1);
    expect(
      await prisma.imageCleanupTask.findMany({ where: { imageId: image.id } }),
    ).toEqual([
      expect.objectContaining({
        key: `${image.storageKeyBase}/medium.webp`,
        attempts: 3,
      }),
    ]);
    storage.failDeleteSuffix = undefined;
    await remove(`product-images/${image.id}`).expect(204);
    expect(storage.objects.size).toBe(0);
  });

  it('retries transient storage failures inside the request', async () => {
    const image = await createImage();
    storage.failDeleteCount = 1;
    await remove(`product-images/${image.id}`).expect(204);
    expect(storage.deletes).toHaveLength(4);
    expect(storage.objects.size).toBe(0);
  });

  it('rolls back deletion and outbox atomically on a database failure', async () => {
    const image = await createImage();
    failDelete = true;
    await remove(`product-images/${image.id}`).expect(500);
    expect(storage.deletes).toHaveLength(0);
    expect(
      await prisma.productImage.findUnique({ where: { id: image.id } }),
    ).not.toBeNull();
    expect(
      await prisma.imageCleanupTask.count({ where: { imageId: image.id } }),
    ).toBe(0);
    failDelete = false;
    await remove(`product-images/${image.id}`).expect(204);
  });

  it('retries DB acknowledgement failure after the objects were already removed', async () => {
    const image = await createImage();
    failTaskAck = true;
    await remove(`product-images/${image.id}`).expect(503);
    expect(storage.objects.size).toBe(0);
    expect(
      await prisma.imageCleanupTask.count({ where: { imageId: image.id } }),
    ).toBe(3);
    failTaskAck = false;
    await remove(`product-images/${image.id}`).expect(204);
    expect(
      await prisma.imageCleanupTask.count({ where: { imageId: image.id } }),
    ).toBe(0);
  });

  it('protects foreign storage keys even if a DB record is inconsistent', async () => {
    const image = await createImage();
    const foreign = await createImage();
    await prisma.productImage.update({
      where: { id: image.id },
      data: { storageKeyBase: `products/${otherProductId}/${image.id}` },
    });
    await remove(`product-images/${image.id}`).expect(409);
    expect(storage.deletes).toHaveLength(0);
    expect(storage.objects.has(`${foreign.storageKeyBase}/large.webp`)).toBe(
      true,
    );
  });

  it('deletes a variant gallery, preserves shared/other galleries and the last-variant rule', async () => {
    const temporary = await prisma.productVariant.create({
      data: { productId, slug: randomUUID(), sku: randomUUID() },
    });
    const shared = await createImage();
    const other = await createImage({ variantId });
    const removed = await createImage({ variantId: temporary.id });
    await remove(`product-variants/${temporary.id}`).expect(204);
    await remove(`product-variants/${temporary.id}`).expect(204);
    expect(storage.objects.size).toBe(6);
    expect(storage.objects.has(`${removed.storageKeyBase}/large.webp`)).toBe(
      false,
    );
    expect(storage.objects.has(`${shared.storageKeyBase}/large.webp`)).toBe(
      true,
    );
    expect(storage.objects.has(`${other.storageKeyBase}/large.webp`)).toBe(
      true,
    );
    await remove(`product-variants/${variantId}`).expect(409);
    expect(storage.objects.size).toBe(6);
  });

  it('keeps one default variant during concurrent variant deletions', async () => {
    const temporary = await prisma.product.create({
      data: {
        name: 'Delete race',
        slug: randomUUID(),
        brandId,
        variants: {
          create: [
            { slug: randomUUID(), sku: randomUUID(), isDefault: true },
            { slug: randomUUID(), sku: randomUUID() },
          ],
        },
      },
      include: { variants: true },
    });
    const responses = await Promise.all(
      temporary.variants.map((variant) =>
        remove(`product-variants/${variant.id}`),
      ),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([204, 409]);
    const remaining = await prisma.productVariant.findMany({
      where: { productId: temporary.id },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.isDefault).toBe(true);
  });

  it('cascades product cleanup across all its galleries without touching another product', async () => {
    const temporary = await prisma.product.create({
      data: {
        name: 'Delete product',
        slug: randomUUID(),
        brandId,
        variants: {
          create: { slug: randomUUID(), sku: randomUUID(), isDefault: true },
        },
      },
      include: { variants: true },
    });
    const shared = await upload(temporary.id)
      .attach('file', photo, 'photo.jpg')
      .expect(201);
    await upload(temporary.id)
      .field('variantId', temporary.variants[0]!.id)
      .attach('file', photo, 'photo.jpg')
      .expect(201);
    const keep = await createImage();
    storage.failDeleteSuffix = '/large.webp';
    await remove(`products/${temporary.id}`).expect(503);
    expect(
      await prisma.product.findUnique({ where: { id: temporary.id } }),
    ).toBeNull();
    storage.failDeleteSuffix = undefined;
    await remove(`products/${temporary.id}`).expect(204);
    expect(storage.objects.size).toBe(3);
    expect(storage.objects.has(`${keep.storageKeyBase}/large.webp`)).toBe(true);
    expect(
      storage.objects.has(
        `${ProductImageSchema.parse(shared.body).storageKeyBase}/large.webp`,
      ),
    ).toBe(false);
  });

  it('compensates an upload that finishes after its product was deleted', async () => {
    const temporary = await prisma.product.create({
      data: {
        name: 'Upload race',
        slug: randomUUID(),
        brandId,
        variants: {
          create: { slug: randomUUID(), sku: randomUUID(), isDefault: true },
        },
      },
    });
    storage.afterPut = async () => {
      storage.afterPut = undefined;
      await remove(`products/${temporary.id}`).expect(204);
    };
    await upload(temporary.id).attach('file', photo, 'photo.jpg').expect(404);
    expect(storage.objects.size).toBe(0);
    expect(
      await prisma.imageCleanupTask.count({
        where: { productId: temporary.id },
      }),
    ).toBe(0);
  });

  it('compensates an upload that finishes after its variant was deleted', async () => {
    const temporary = await prisma.productVariant.create({
      data: { productId, sku: randomUUID(), slug: randomUUID() },
    });
    storage.afterPut = async () => {
      storage.afterPut = undefined;
      await remove(`product-variants/${temporary.id}`).expect(204);
    };
    await upload()
      .field('variantId', temporary.id)
      .attach('file', photo, 'photo.jpg')
      .expect(404);
    expect(storage.objects.size).toBe(0);
  });

  it('protects active, soft-deleted and fresh objects and scans paginated orphan listings', async () => {
    const image = await createImage();
    await prisma.product.update({
      where: { id: productId },
      data: { deletedAt: old },
    });
    await prisma.productImage.update({
      where: { id: image.id },
      data: { createdAt: old },
    });
    for (const key of storage.objects.keys()) storage.modifiedAt.set(key, old);
    const orphans = [addOrphan(), addOrphan(), addOrphan()];
    const fresh = addOrphan(undefined, new Date());
    const unrelated = addOrphan('products/manual-upload.webp');
    const dry = await recover();
    expect(dry.dryRun).toBe(true);
    expect(dry.events.filter(({ kind }) => kind === 'orphan')).toHaveLength(3);
    expect(storage.deletes).toHaveLength(0);
    expect(await prisma.imageCleanupTask.count({ where: { productId } })).toBe(
      0,
    );
    const result = await recover(true);
    expect(result.failures).toBe(0);
    for (const key of orphans) expect(storage.objects.has(key)).toBe(false);
    for (const key of [fresh, unrelated, `${image.storageKeyBase}/large.webp`])
      expect(storage.objects.has(key)).toBe(true);
    await prisma.product.update({
      where: { id: productId },
      data: { deletedAt: null },
    });
  });

  it('reports missing derivatives and removes broken records only with the explicit option', async () => {
    const image = await createImage();
    await prisma.productImage.update({
      where: { id: image.id },
      data: { createdAt: old },
    });
    storage.objects.delete(`${image.storageKeyBase}/medium.webp`);
    expect((await recover()).events).toContainEqual({
      kind: 'missing-files',
      imageId: image.id,
      keys: [`${image.storageKeyBase}/medium.webp`],
    });
    await recover(true);
    expect(
      await prisma.productImage.findUnique({ where: { id: image.id } }),
    ).not.toBeNull();
    await recover(false, true);
    expect(storage.deletes).toHaveLength(0);
    await recover(true, true);
    expect(
      await prisma.productImage.findUnique({ where: { id: image.id } }),
    ).toBeNull();
    expect(storage.objects.size).toBe(0);
  });

  it('does not treat a HEAD permission/network failure as a missing file', async () => {
    const image = await createImage();
    await prisma.productImage.update({
      where: { id: image.id },
      data: { createdAt: old },
    });
    storage.failHead = true;
    const result = await recover(true, true);
    expect(result.failures).toBe(1);
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ kind: 'missing-files' }),
    );
    expect(storage.deletes).toHaveLength(0);
  });

  it('recovers a persisted cleanup task after a failed delete', async () => {
    const image = await createImage();
    storage.failDeleteSuffix = '/large.webp';
    await remove(`product-images/${image.id}`).expect(503);
    storage.failDeleteSuffix = undefined;
    await prisma.imageCleanupTask.updateMany({
      where: { imageId: image.id },
      data: { nextAttemptAt: old },
    });
    const dry = await recover();
    expect(dry.events).toContainEqual({
      kind: 'pending-cleanup',
      key: `${image.storageKeyBase}/large.webp`,
    });
    expect(storage.objects.size).toBe(1);
    await recover(true);
    expect(storage.objects.size).toBe(0);
  });

  it('rejects expired uploads before commit so recovery cannot race a late insert', async () => {
    const now = Date.now();
    let clock: ReturnType<typeof jest.spyOn> | undefined;
    storage.afterPut = async () => {
      if (storage.puts.length === 3)
        clock = jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60_000);
    };
    try {
      await upload().attach('file', photo, 'photo.jpg').expect(408);
      expect(storage.objects.size).toBe(0);
      expect(await prisma.productImage.count({ where: { productId } })).toBe(0);
    } finally {
      clock?.mockRestore();
    }
  });

  it('rechecks object age after LIST before deleting an orphan', async () => {
    const key = addOrphan();
    const head = jest
      .spyOn(storage, 'headObject')
      .mockResolvedValueOnce({ lastModified: new Date() });
    try {
      await recover(true);
      expect(storage.objects.has(key)).toBe(true);
      expect(storage.deletes).toHaveLength(0);
    } finally {
      head.mockRestore();
    }
  });

  it('never executes a stale cleanup task for a referenced image', async () => {
    const image = await createImage();
    const key = `${image.storageKeyBase}/large.webp`;
    await prisma.imageCleanupTask.create({
      data: { key, productId, imageId: image.id },
    });
    await app.get(ImageCleanupService).execute(key);
    expect(storage.deletes).toHaveLength(0);
    expect(storage.objects.size).toBe(3);
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
