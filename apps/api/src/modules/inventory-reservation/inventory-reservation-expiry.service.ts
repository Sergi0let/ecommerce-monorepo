import { Injectable } from '@nestjs/common';
import { InventoryReservationStatus, Prisma } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';

const EXPIRY_BATCH_SIZE = 100;

type LockedReservation = {
  id: string;
};

type LockedInventory = {
  id: string;
  reserved: number;
};

@Injectable()
export class InventoryReservationExpiryService {
  constructor(private readonly prisma: PrismaService) {}

  async expireDueReservations(batchSize = EXPIRY_BATCH_SIZE): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new RangeError('batchSize must be a positive integer');
    }

    let expiredCount = 0;

    while (expiredCount < batchSize) {
      const expired = await this.expireNextReservation();

      if (!expired) {
        break;
      }

      expiredCount += 1;
    }

    return expiredCount;
  }

  private expireNextReservation(): Promise<boolean> {
    return this.prisma.client.$transaction(
      async (tx) => {
        const [lockedReservation] = await tx.$queryRaw<LockedReservation[]>(
          Prisma.sql`
            SELECT "id"
            FROM "InventoryReservation"
            WHERE "status" = ${InventoryReservationStatus.ACTIVE}::"InventoryReservationStatus"
              AND "expiresAt" <= CURRENT_TIMESTAMP
            ORDER BY "expiresAt", "id"
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          `,
        );

        if (!lockedReservation) {
          return false;
        }

        const reservation = await tx.inventoryReservation.findUniqueOrThrow({
          where: { id: lockedReservation.id },
          include: { items: true },
        });

        const inventoryIds = reservation.items
          .map((item) => item.inventoryId)
          .sort();

        if (inventoryIds.length > 0) {
          const lockedInventories = await tx.$queryRaw<LockedInventory[]>(
            Prisma.sql`
              SELECT "id", "reserved"
              FROM "Inventory"
              WHERE "id" IN (${Prisma.join(inventoryIds)})
              ORDER BY "id"
              FOR UPDATE
            `,
          );
          const inventoryById = new Map(
            lockedInventories.map((inventory) => [inventory.id, inventory]),
          );

          for (const item of reservation.items) {
            const inventory = inventoryById.get(item.inventoryId);

            if (!inventory || inventory.reserved < item.quantity) {
              throw new Error(
                `Cannot expire reservation ${reservation.id}: invalid reserved quantity for inventory ${item.inventoryId}`,
              );
            }

            const result = await tx.inventory.updateMany({
              where: {
                id: item.inventoryId,
                reserved: { gte: item.quantity },
              },
              data: {
                reserved: { decrement: item.quantity },
              },
            });

            if (result.count !== 1) {
              throw new Error(
                `Cannot expire reservation ${reservation.id}: inventory ${item.inventoryId} changed concurrently`,
              );
            }
          }
        }

        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: InventoryReservationStatus.EXPIRED },
        });

        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
