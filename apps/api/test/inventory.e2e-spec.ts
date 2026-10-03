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
import {
  CreateInventorySchema,
  UpdateInventorySchema,
  UserRole,
} from '@repo/contracts';
import { prisma } from '@repo/database';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExeptionFilter } from '../src/common/filters/prisma.filter';
import { MailService } from '../src/modules/mail/mail.service';

describe('Inventory integration', () => {
  let app: INestApplication;
  let accessToken: string;

  const fixtureId = randomUUID();
  const brandId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  const warehouseId = randomUUID();
  const inventoryId = randomUUID();
  let adminId: number;

  const inventoryInput = {
    variantId,
    warehouseId,
    quantity: 10,
    incoming: 2,
  };

  const createInventory = (reserved: number) =>
    prisma.inventory.create({
      data: {
        id: inventoryId,
        ...inventoryInput,
        reserved,
      },
    });

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
        name: 'Inventory fixture',
        slug: `inventory-${fixtureId}`,
      },
    });
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Inventory fixture product',
        slug: `inventory-${fixtureId}`,
        brandId,
        variants: {
          create: {
            id: variantId,
            slug: `inventory-${fixtureId}`,
            sku: `inventory-${fixtureId}`,
            isDefault: true,
          },
        },
      },
    });
    await prisma.warehouse.create({
      data: {
        id: warehouseId,
        name: 'Inventory fixture warehouse',
        code: `inventory-${fixtureId}`,
      },
    });
  });

  beforeEach(async () => {
    await prisma.inventory.deleteMany({ where: { warehouseId } });
  });

  afterAll(async () => {
    try {
      await prisma.inventory.deleteMany({ where: { warehouseId } });
      await prisma.product.deleteMany({ where: { id: productId } });
      await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
      await prisma.brand.deleteMany({ where: { id: brandId } });
      await prisma.user.deleteMany({ where: { id: adminId } });
    } finally {
      await app?.close();
    }
  });

  it('keeps reserved out of create and update inputs', () => {
    const createResult = CreateInventorySchema.parse({
      ...inventoryInput,
      reserved: 7,
    });
    const updateResult = UpdateInventorySchema.parse({
      quantity: 8,
      reserved: 3,
    });

    expect(createResult).not.toHaveProperty('reserved');
    expect(updateResult).not.toHaveProperty('reserved');
  });

  it('creates inventory with reserved equal to zero', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/inventory')
      .auth(accessToken, { type: 'bearer' })
      .send({ ...inventoryInput, reserved: 7 })
      .expect(201);

    expect(response.body).toMatchObject({
      variantId,
      warehouseId,
      quantity: 10,
      reserved: 0,
      incoming: 2,
    });

    await expect(
      prisma.inventory.findUniqueOrThrow({
        where: { variantId_warehouseId: { variantId, warehouseId } },
      }),
    ).resolves.toMatchObject({ reserved: 0 });
  });

  it('does not lower quantity below the current reserved amount', async () => {
    await createInventory(4);

    await request(app.getHttpServer())
      .put(`/api/inventory/id/${inventoryId}`)
      .auth(accessToken, { type: 'bearer' })
      .send({ quantity: 3, reserved: 0 })
      .expect(400);

    await expect(
      prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } }),
    ).resolves.toMatchObject({ quantity: 10, reserved: 4 });

    const response = await request(app.getHttpServer())
      .put(`/api/inventory/id/${inventoryId}`)
      .auth(accessToken, { type: 'bearer' })
      .send({ quantity: 4 })
      .expect(200);

    expect(response.body).toMatchObject({ quantity: 4, reserved: 4 });
  });

  it('deletes inventory only when it has no reserved stock', async () => {
    await createInventory(2);

    await request(app.getHttpServer())
      .delete(`/api/inventory/${inventoryId}`)
      .auth(accessToken, { type: 'bearer' })
      .expect(400);

    await expect(
      prisma.inventory.findUnique({ where: { id: inventoryId } }),
    ).resolves.not.toBeNull();

    await prisma.inventory.update({
      where: { id: inventoryId },
      data: { reserved: 0 },
    });

    await request(app.getHttpServer())
      .delete(`/api/inventory/${inventoryId}`)
      .auth(accessToken, { type: 'bearer' })
      .expect(204);

    await expect(
      prisma.inventory.findUnique({ where: { id: inventoryId } }),
    ).resolves.toBeNull();
  });
});
