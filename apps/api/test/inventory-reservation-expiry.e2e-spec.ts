import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@repo/database';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { InventoryReservationExpiryService } from '../src/modules/inventory-reservation/inventory-reservation-expiry.service';
import { MailService } from '../src/modules/mail/mail.service';

describe('Inventory reservation expiry integration', () => {
  let app: INestApplication;
  let expiryService: InventoryReservationExpiryService;

  const fixtureId = randomUUID();
  const brandId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  const warehouseId = randomUUID();
  const inventoryId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
    expiryService = app.get(InventoryReservationExpiryService);

    await prisma.brand.create({
      data: {
        id: brandId,
        name: 'Reservation expiry fixture',
        slug: `reservation-expiry-${fixtureId}`,
      },
    });
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Reservation expiry fixture product',
        slug: `reservation-expiry-${fixtureId}`,
        brandId,
        variants: {
          create: {
            id: variantId,
            slug: `reservation-expiry-${fixtureId}`,
            sku: `reservation-expiry-${fixtureId}`,
            isDefault: true,
          },
        },
      },
    });
    await prisma.warehouse.create({
      data: {
        id: warehouseId,
        name: 'Reservation expiry warehouse',
        code: `reservation-expiry-${fixtureId}`,
      },
    });
    await prisma.inventory.create({
      data: {
        id: inventoryId,
        variantId,
        warehouseId,
        quantity: 10,
      },
    });
  });

  beforeEach(async () => {
    await prisma.inventoryReservation.deleteMany();
    await prisma.inventory.update({
      where: { id: inventoryId },
      data: { quantity: 10, reserved: 0 },
    });
  });

  afterAll(async () => {
    try {
      await prisma.inventoryReservation.deleteMany();
      await prisma.inventory.deleteMany({ where: { id: inventoryId } });
      await prisma.product.deleteMany({ where: { id: productId } });
      await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
      await prisma.brand.deleteMany({ where: { id: brandId } });
    } finally {
      await app?.close();
    }
  });

  it('expires a due reservation once under concurrent cleanup', async () => {
    const reservation = await prisma.$transaction(async (transaction) => {
      const created = await transaction.inventoryReservation.create({
        data: {
          idempotencyKey: randomUUID(),
          expiresAt: new Date(Date.now() - 1_000),
          items: { create: { inventoryId, quantity: 2 } },
        },
      });

      await transaction.inventory.update({
        where: { id: inventoryId },
        data: { reserved: { increment: 2 } },
      });

      return created;
    });

    const cleanupCounts = await Promise.all([
      expiryService.expireDueReservations(),
      expiryService.expireDueReservations(),
    ]);

    expect(cleanupCounts.reduce((sum, count) => sum + count, 0)).toBe(1);
    await expect(
      prisma.inventoryReservation.findUniqueOrThrow({
        where: { id: reservation.id },
      }),
    ).resolves.toMatchObject({ status: 'EXPIRED' });
    await expect(
      prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } }),
    ).resolves.toMatchObject({ quantity: 10, reserved: 0 });
    await expect(expiryService.expireDueReservations()).resolves.toBe(0);
  });

  it('rejects non-positive reservation item quantity at database level', async () => {
    await expect(
      prisma.inventoryReservation.create({
        data: {
          idempotencyKey: randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
          items: { create: { inventoryId, quantity: 0 } },
        },
      }),
    ).rejects.toBeDefined();
    await expect(prisma.inventoryReservation.count()).resolves.toBe(0);
  });
});
