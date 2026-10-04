import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@repo/contracts';
import { prisma } from '@repo/database';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExeptionFilter } from '../src/common/filters/prisma.filter';
import { MailService } from '../src/modules/mail/mail.service';

describe('Inventory reservation integration', () => {
  let app: INestApplication;
  let accessToken: string;
  let adminId: number;

  const fixtureId = randomUUID();
  const brandId = randomUUID();
  const productId = randomUUID();
  const firstVariantId = randomUUID();
  const secondVariantId = randomUUID();
  const activeWarehouseId = randomUUID();
  const inactiveWarehouseId = randomUUID();
  const firstInventoryId = randomUUID();
  const secondInventoryId = randomUUID();
  const inactiveInventoryId = randomUUID();

  const reserve = (
    idempotencyKey: string,
    items: Array<{ inventoryId: string; quantity: number }> = [
      { inventoryId: firstInventoryId, quantity: 2 },
    ],
  ) =>
    request(app.getHttpServer())
      .post('/api/inventory-reservations')
      .auth(accessToken, { type: 'bearer' })
      .send({ idempotencyKey, items });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new PrismaExeptionFilter());
    await app.init();

    const admin = await prisma.user.create({
      data: {
        email: `${fixtureId}@example.com`,
        role: UserRole.ADMIN,
      },
    });
    adminId = admin.id;

    accessToken = await app
      .get(JwtService)
      .signAsync(
        { id: admin.id, email: admin.email, role: admin.role },
        { secret: 'test-access-secret', expiresIn: '15m' },
      );

    await prisma.brand.create({
      data: {
        id: brandId,
        name: 'Inventory reservation fixture',
        slug: `inventory-reservation-${fixtureId}`,
      },
    });
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Inventory reservation fixture product',
        slug: `inventory-reservation-${fixtureId}`,
        brandId,
        variants: {
          create: [
            {
              id: firstVariantId,
              slug: `inventory-reservation-first-${fixtureId}`,
              sku: `inventory-reservation-first-${fixtureId}`,
              isDefault: true,
            },
            {
              id: secondVariantId,
              slug: `inventory-reservation-second-${fixtureId}`,
              sku: `inventory-reservation-second-${fixtureId}`,
            },
          ],
        },
      },
    });
    await prisma.warehouse.createMany({
      data: [
        {
          id: activeWarehouseId,
          name: 'Active reservation warehouse',
          code: `reservation-active-${fixtureId}`,
        },
        {
          id: inactiveWarehouseId,
          name: 'Inactive reservation warehouse',
          code: `reservation-inactive-${fixtureId}`,
          isActive: false,
        },
      ],
    });
    await prisma.inventory.createMany({
      data: [
        {
          id: firstInventoryId,
          variantId: firstVariantId,
          warehouseId: activeWarehouseId,
          quantity: 10,
        },
        {
          id: secondInventoryId,
          variantId: secondVariantId,
          warehouseId: activeWarehouseId,
          quantity: 5,
        },
        {
          id: inactiveInventoryId,
          variantId: firstVariantId,
          warehouseId: inactiveWarehouseId,
          quantity: 10,
        },
      ],
    });
  });

  beforeEach(async () => {
    await prisma.inventoryReservation.deleteMany();
    await prisma.inventory.update({
      where: { id: firstInventoryId },
      data: { quantity: 10, reserved: 0 },
    });
    await prisma.inventory.update({
      where: { id: secondInventoryId },
      data: { quantity: 5, reserved: 0 },
    });
    await prisma.inventory.update({
      where: { id: inactiveInventoryId },
      data: { quantity: 10, reserved: 0 },
    });
  });

  afterAll(async () => {
    try {
      await prisma.inventoryReservation.deleteMany();
      await prisma.inventory.deleteMany({
        where: {
          id: {
            in: [firstInventoryId, secondInventoryId, inactiveInventoryId],
          },
        },
      });
      await prisma.product.deleteMany({ where: { id: productId } });
      await prisma.warehouse.deleteMany({
        where: { id: { in: [activeWarehouseId, inactiveWarehouseId] } },
      });
      await prisma.brand.deleteMany({ where: { id: brandId } });
      await prisma.user.deleteMany({ where: { id: adminId } });
    } finally {
      await app?.close();
    }
  });

  it('reserves multiple inventory items atomically', async () => {
    const response = await reserve(randomUUID(), [
      { inventoryId: firstInventoryId, quantity: 2 },
      { inventoryId: secondInventoryId, quantity: 3 },
    ]).expect(201);

    expect(response.body).toMatchObject({
      status: 'ACTIVE',
      items: [
        { inventoryId: firstInventoryId, quantity: 2 },
        { inventoryId: secondInventoryId, quantity: 3 },
      ].sort((left, right) =>
        left.inventoryId.localeCompare(right.inventoryId),
      ),
    });
    expect(Date.parse(response.body.expiresAt as string)).toBeGreaterThan(
      Date.now(),
    );

    const inventories = await prisma.inventory.findMany({
      where: { id: { in: [firstInventoryId, secondInventoryId] } },
      orderBy: { id: 'asc' },
    });
    expect(inventories.map(({ id, reserved }) => ({ id, reserved }))).toEqual(
      [
        { id: firstInventoryId, reserved: 2 },
        { id: secondInventoryId, reserved: 3 },
      ].sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  it('rolls back a multi-item reserve when one item lacks stock', async () => {
    await reserve(randomUUID(), [
      { inventoryId: firstInventoryId, quantity: 2 },
      { inventoryId: secondInventoryId, quantity: 6 },
    ]).expect(409);

    await expect(
      prisma.inventory.findUniqueOrThrow({ where: { id: firstInventoryId } }),
    ).resolves.toMatchObject({ reserved: 0 });
    await expect(prisma.inventoryReservation.count()).resolves.toBe(0);
  });

  it('returns the same reservation for the same idempotent request', async () => {
    const idempotencyKey = randomUUID();
    const firstResponse = await reserve(idempotencyKey).expect(201);
    const repeatedResponse = await reserve(idempotencyKey).expect(201);

    expect(repeatedResponse.body.id).toBe(firstResponse.body.id);
    await expect(
      prisma.inventory.findUniqueOrThrow({ where: { id: firstInventoryId } }),
    ).resolves.toMatchObject({ reserved: 2 });

    await reserve(idempotencyKey, [
      { inventoryId: firstInventoryId, quantity: 3 },
    ]).expect(409);
  });

  it('allows only one concurrent reserve for the last unit', async () => {
    await prisma.inventory.update({
      where: { id: firstInventoryId },
      data: { quantity: 1 },
    });

    const responses = await Promise.all([
      reserve(randomUUID(), [{ inventoryId: firstInventoryId, quantity: 1 }]),
      reserve(randomUUID(), [{ inventoryId: firstInventoryId, quantity: 1 }]),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    await expect(
      prisma.inventory.findUniqueOrThrow({ where: { id: firstInventoryId } }),
    ).resolves.toMatchObject({ quantity: 1, reserved: 1 });
    await expect(prisma.inventoryReservation.count()).resolves.toBe(1);
  });

  it('releases stock once and rejects consume after release', async () => {
    const created = await reserve(randomUUID()).expect(201);
    const reservationId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/inventory-reservations/${reservationId}/release`)
      .auth(accessToken, { type: 'bearer' })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('RELEASED'));

    await request(app.getHttpServer())
      .post(`/api/inventory-reservations/${reservationId}/release`)
      .auth(accessToken, { type: 'bearer' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/inventory-reservations/${reservationId}/consume`)
      .auth(accessToken, { type: 'bearer' })
      .expect(409);

    await expect(
      prisma.inventory.findUniqueOrThrow({ where: { id: firstInventoryId } }),
    ).resolves.toMatchObject({ quantity: 10, reserved: 0 });
  });

  it('consumes stock once and rejects release after consume', async () => {
    const created = await reserve(randomUUID()).expect(201);
    const reservationId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/inventory-reservations/${reservationId}/consume`)
      .auth(accessToken, { type: 'bearer' })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('CONSUMED'));

    await request(app.getHttpServer())
      .post(`/api/inventory-reservations/${reservationId}/consume`)
      .auth(accessToken, { type: 'bearer' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/inventory-reservations/${reservationId}/release`)
      .auth(accessToken, { type: 'bearer' })
      .expect(409);

    await expect(
      prisma.inventory.findUniqueOrThrow({ where: { id: firstInventoryId } }),
    ).resolves.toMatchObject({ quantity: 8, reserved: 0 });
  });

  it('does not reserve inventory in an inactive warehouse', async () => {
    await reserve(randomUUID(), [
      { inventoryId: inactiveInventoryId, quantity: 1 },
    ]).expect(409);

    await expect(
      prisma.inventory.findUniqueOrThrow({
        where: { id: inactiveInventoryId },
      }),
    ).resolves.toMatchObject({ reserved: 0 });
  });
});
