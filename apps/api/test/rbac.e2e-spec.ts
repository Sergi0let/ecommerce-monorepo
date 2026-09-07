import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  BrandProductsResponseSchema,
  CategoryProductsResponseSchema,
  ProductListItemSchema,
  ProductPriceSchema,
  ProductsResponseSchema,
  UserRole,
} from '@repo/contracts';
import { prisma } from '@repo/database';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/modules/mail/mail.service';

const fixtureId = randomUUID();
const brandId = randomUUID();
const categoryId = randomUUID();
const productId = randomUUID();
const variantId = randomUUID();
const priceId = randomUUID();
const warehouseId = randomUUID();
const inventoryId = randomUUID();
const slug = `rbac-${fixtureId}`;

const mutationResources = [
  'brands',
  'categories',
  'ingredients',
  'inventory',
  'product-images',
  'product-prices',
  'product-variants',
  'products',
  'warehouse',
] as const;

const protectedRoutes = [
  ...mutationResources.flatMap((resource) => [
    { method: 'post' as const, path: `/api/${resource}` },
    { method: 'put' as const, path: `/api/${resource}/id/${fixtureId}` },
    { method: 'delete' as const, path: `/api/${resource}/${fixtureId}` },
  ]),
  { method: 'get' as const, path: `/api/inventory/id/${inventoryId}` },
  { method: 'get' as const, path: `/api/inventory/by-product/${variantId}` },
  { method: 'get' as const, path: '/api/product-prices' },
  { method: 'get' as const, path: `/api/product-prices/id/${priceId}` },
  { method: 'get' as const, path: `/api/product-variants/id/${variantId}` },
  { method: 'get' as const, path: `/api/products/id/${productId}` },
  { method: 'get' as const, path: '/api/warehouse' },
  { method: 'get' as const, path: `/api/warehouse/id/${warehouseId}` },
  { method: 'get' as const, path: '/api/users' },
  { method: 'get' as const, path: '/api/users/1' },
];

describe('RBAC and catalog privacy integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const tokens = new Map<UserRole, string>();
  const userIds: number[] = [];
  let customerId: number;

  const signToken = (id: number, role: UserRole) =>
    jwtService.signAsync(
      { id, email: `${id}@example.com`, role },
      { secret: 'test-access-secret', expiresIn: '15m' },
    );

  const createUser = async (role: UserRole) => {
    const user = await prisma.user.create({
      data: { email: `${randomUUID()}@example.com`, role },
    });
    userIds.push(user.id);
    return user;
  };

  const tokenFor = (role: UserRole): string => {
    const token = tokens.get(role);
    if (!token) throw new Error(`Missing test token for ${role}`);
    return token;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
    jwtService = app.get(JwtService);

    for (const role of [UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN]) {
      const user = await createUser(role);
      if (role === UserRole.CUSTOMER) customerId = user.id;
      tokens.set(role, await signToken(user.id, role));
    }

    await prisma.brand.create({ data: { id: brandId, name: 'RBAC', slug } });
    await prisma.category.create({
      data: { id: categoryId, name: 'RBAC', slug },
    });
    await prisma.product.create({
      data: {
        id: productId,
        name: 'RBAC product',
        slug,
        brandId,
        categoryId,
        variants: {
          create: { id: variantId, slug, sku: slug, isDefault: true },
        },
      },
    });
    await prisma.price.create({
      data: {
        id: priceId,
        variantId,
        amountCents: 10000,
        costCents: 4321,
        compareAtCents: 12000,
      },
    });
    await prisma.price.createMany({
      data: [
        {
          variantId,
          amountCents: 8000,
          costCents: 3210,
          isValidTo: new Date('2000-01-01'),
        },
        {
          variantId,
          amountCents: 15000,
          costCents: 5432,
          isValidFrom: new Date('2100-01-01'),
        },
      ],
    });
    await prisma.warehouse.create({
      data: { id: warehouseId, name: 'RBAC warehouse', code: slug },
    });
    await prisma.inventory.create({
      data: {
        id: inventoryId,
        variantId,
        warehouseId,
        quantity: 10,
        reserved: 2,
        incoming: 5,
        location: 'Internal shelf',
        batchNumber: 'Internal batch',
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.product.deleteMany({ where: { brandId } });
      await prisma.brand.deleteMany({ where: { id: brandId } });
      await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  });

  it.each(protectedRoutes)(
    '$method $path rejects anonymous requests',
    async ({ method, path }) => {
      await request(app.getHttpServer())[method](path).expect(401);
    },
  );

  it.each(protectedRoutes)(
    '$method $path rejects customers',
    async ({ method, path }) => {
      await request(app.getHttpServer())
        [method](path)
        .auth(tokenFor(UserRole.CUSTOMER), { type: 'bearer' })
        .expect(403);
    },
  );

  describe.each([UserRole.ADMIN, UserRole.MANAGER])('%s access', (role) => {
    it.each([
      `/api/inventory/id/${inventoryId}`,
      `/api/inventory/by-product/${variantId}`,
      '/api/product-prices',
      `/api/product-prices/id/${priceId}`,
      '/api/warehouse',
      `/api/warehouse/id/${warehouseId}`,
      `/api/products/id/${productId}`,
      `/api/product-variants/id/${variantId}`,
    ])('allows GET %s', async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .auth(tokenFor(role), { type: 'bearer' })
        .expect(200);
    });

    it('allows reading a user profile by ID', async () => {
      await request(app.getHttpServer())
        .get(`/api/users/${customerId}`)
        .auth(tokenFor(role), { type: 'bearer' })
        .expect(200);
    });

    it('allows creating, updating and deleting a category', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/categories')
        .auth(tokenFor(role), { type: 'bearer' })
        .send({ name: 'RBAC temporary category', slug: randomUUID() })
        .expect(201);
      const id = response.body.id as string;

      try {
        await request(app.getHttpServer())
          .put(`/api/categories/id/${id}`)
          .auth(tokenFor(role), { type: 'bearer' })
          .send({ name: 'Updated category' })
          .expect(200);
        await request(app.getHttpServer())
          .delete(`/api/categories/${id}`)
          .auth(tokenFor(role), { type: 'bearer' })
          .expect(204);
        expect(await prisma.category.findUnique({ where: { id } })).toBeNull();
      } finally {
        await prisma.category.deleteMany({ where: { id } });
      }
    });

    it('keeps internal costs available through the protected price endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/product-prices/id/${priceId}`)
        .auth(tokenFor(role), { type: 'bearer' })
        .expect(200);

      expect(response.body.costCents).toBe(4321);
      expect(ProductPriceSchema.safeParse(response.body).success).toBe(true);
    });
  });

  it('allows only admins to list users', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(tokenFor(UserRole.MANAGER), { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(tokenFor(UserRole.ADMIN), { type: 'bearer' })
      .expect(200);
  });

  it('allows only admins to delete a product and preserves it after a denied request', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Temporary product',
        slug: randomUUID(),
        brandId,
        variants: {
          create: { slug: randomUUID(), sku: randomUUID(), isDefault: true },
        },
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/products/${product.id}`)
      .auth(tokenFor(UserRole.MANAGER), { type: 'bearer' })
      .expect(403);
    expect(
      await prisma.product.findUnique({ where: { id: product.id } }),
    ).not.toBeNull();
    await request(app.getHttpServer())
      .delete(`/api/products/${product.id}`)
      .auth(tokenFor(UserRole.ADMIN), { type: 'bearer' })
      .expect(204);
    expect(
      await prisma.product.findUnique({ where: { id: product.id } }),
    ).toBeNull();
  });

  it('accepts access-token cookies on protected routes', async () => {
    await request(app.getHttpServer())
      .get('/api/product-prices')
      .set('Cookie', `access_token=${tokenFor(UserRole.MANAGER)}`)
      .expect(200);
  });

  it('keeps the current-user endpoint accessible to customers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .auth(tokenFor(UserRole.CUSTOMER), { type: 'bearer' })
      .expect(200);
    expect(response.body.id).toBe(String(customerId));
  });

  it('rejects invalid and expired access tokens', async () => {
    const expired = await jwtService.signAsync(
      { id: customerId },
      { secret: 'test-access-secret', expiresIn: -1 },
    );
    for (const token of ['invalid-token', expired]) {
      await request(app.getHttpServer())
        .get('/api/product-prices')
        .auth(token, { type: 'bearer' })
        .expect(401);
    }
  });

  it.each([null, '1', 0, -1, 1.5, 2_147_483_648])(
    'rejects invalid JWT user ID %s',
    async (id) => {
      const token = await jwtService.signAsync(
        { id, role: UserRole.ADMIN },
        { secret: 'test-access-secret', expiresIn: '15m' },
      );
      await request(app.getHttpServer())
        .get('/api/product-prices')
        .auth(token, { type: 'bearer' })
        .expect(401);
    },
  );

  it('uses the current database role instead of a stale admin claim', async () => {
    const user = await createUser(UserRole.ADMIN);
    const token = await signToken(user.id, UserRole.ADMIN);
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(token, { type: 'bearer' })
      .expect(200);

    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.MANAGER },
    });
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/product-prices')
      .auth(token, { type: 'bearer' })
      .expect(200);

    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.CUSTOMER },
    });
    await request(app.getHttpServer())
      .get('/api/product-prices')
      .auth(token, { type: 'bearer' })
      .expect(403);
  });

  it('rejects existing bearer and cookie tokens immediately after deactivation', async () => {
    const user = await createUser(UserRole.ADMIN);
    const token = await signToken(user.id, UserRole.ADMIN);
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .get('/api/users')
      .auth(token, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', `access_token=${token}`)
      .expect(401);
  });

  it('rejects tokens belonging to deleted users', async () => {
    const user = await createUser(UserRole.ADMIN);
    const token = await signToken(user.id, UserRole.ADMIN);
    await prisma.user.delete({ where: { id: user.id } });
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });

  it.each([
    {
      path: `/api/products?limit=100`,
      schema: ProductsResponseSchema,
      paginated: true,
    },
    {
      path: `/api/products/${slug}`,
      schema: ProductListItemSchema,
      paginated: false,
    },
    {
      path: `/api/products/by-variant/${slug}`,
      schema: ProductListItemSchema,
      paginated: false,
    },
    {
      path: `/api/brands/${slug}/products`,
      schema: BrandProductsResponseSchema,
      paginated: true,
    },
    {
      path: `/api/categories/${slug}/products`,
      schema: CategoryProductsResponseSchema,
      paginated: true,
    },
  ])(
    'GET $path stays public and does not expose costs',
    async ({ path, schema, paginated }) => {
      const response = await request(app.getHttpServer()).get(path).expect(200);

      // Check the raw HTTP response before Zod can strip unknown properties.
      expect(response.text).not.toContain('costCents');
      expect(schema.safeParse(response.body).success).toBe(true);
      const products = paginated
        ? ProductsResponseSchema.parse(response.body).data
        : [ProductListItemSchema.parse(response.body)];
      const product = products.find((item) => item.id === productId);
      expect(product).toBeDefined();
      expect(product?.variants[0]?.prices).toEqual([
        expect.objectContaining({
          id: priceId,
          amountCents: 10000,
          compareAtCents: 12000,
        }),
      ]);
    },
  );

  it('documents both class-level and method-level authorization', () => {
    const config = new DocumentBuilder()
      .addBearerAuth()
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, config);

    for (const path of [
      '/api/product-prices',
      '/api/inventory/id/{id}',
      '/api/warehouse',
      '/api/users',
    ]) {
      const operation = document.paths[path]?.get;
      expect(operation?.security).toEqual(
        expect.arrayContaining([{ bearer: [] }, { cookie: [] }]),
      );
      expect(operation?.responses).toHaveProperty('401');
      expect(operation?.responses).toHaveProperty('403');
      for (const requirement of operation?.security ?? []) {
        for (const name of Object.keys(requirement)) {
          expect(document.components?.securitySchemes).toHaveProperty(name);
        }
      }
    }
    expect(document.paths['/api/products']?.get?.security).toBeUndefined();
    expect(
      document.paths['/api/products/{slug}']?.get?.security,
    ).toBeUndefined();
  });
});
