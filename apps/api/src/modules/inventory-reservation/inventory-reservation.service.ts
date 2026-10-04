import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InventoryReservationStatus, Prisma } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';

const RESERVATION_TTL_MS = 15 * 60 * 1000;

const reservationDetailsInclude = {
  items: { orderBy: { inventoryId: 'asc' } },
} satisfies Prisma.InventoryReservationInclude;

type ReservationDetails = Prisma.InventoryReservationGetPayload<{
  include: typeof reservationDetailsInclude;
}>;

type LockedInventoryRow = {
  id: string;
  quantity: number;
  reserved: number;
  warehouseIsActive: boolean;
};

@Injectable()
export class InventoryReservationService {
  private readonly logger = new Logger(InventoryReservationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reserve(data: ReserveInventoryDto) {
    const items = [...data.items].sort((left, right) =>
      left.inventoryId.localeCompare(right.inventoryId),
    );

    const existing = await this.findByIdempotencyKey(
      this.prisma.client,
      data.idempotencyKey,
    );

    if (existing) {
      this.assertSameReserveRequest(existing, items);
      return this.toResponse(existing);
    }

    this.logger.log(`Reserving ${items.length} inventory item(s)`);

    try {
      const reservation = await this.prisma.client.$transaction(
        async (transaction) => {
          const inventories = await this.lockInventoryRows(
            transaction,
            items.map(({ inventoryId }) => inventoryId),
          );

          const concurrentExisting = await this.findByIdempotencyKey(
            transaction,
            data.idempotencyKey,
          );

          if (concurrentExisting) {
            this.assertSameReserveRequest(concurrentExisting, items);
            return concurrentExisting;
          }

          this.assertCanReserve(inventories, items);

          const created = await transaction.inventoryReservation.create({
            data: {
              idempotencyKey: data.idempotencyKey,
              expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
              items: { create: items },
            },
            include: reservationDetailsInclude,
          });

          for (const item of items) {
            await transaction.inventory.update({
              where: { id: item.inventoryId },
              data: { reserved: { increment: item.quantity } },
            });
          }

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );

      return this.toResponse(reservation);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const concurrentReservation = await this.findByIdempotencyKey(
        this.prisma.client,
        data.idempotencyKey,
      );

      if (!concurrentReservation) {
        throw error;
      }

      this.assertSameReserveRequest(concurrentReservation, items);
      return this.toResponse(concurrentReservation);
    }
  }

  async release(reservationId: string) {
    return this.transitionReservation(
      reservationId,
      InventoryReservationStatus.RELEASED,
    );
  }

  async consume(reservationId: string) {
    return this.transitionReservation(
      reservationId,
      InventoryReservationStatus.CONSUMED,
    );
  }

  async getById(reservationId: string) {
    const reservation =
      await this.prisma.client.inventoryReservation.findUnique({
        where: { id: reservationId },
        include: reservationDetailsInclude,
      });

    if (!reservation) {
      throw new NotFoundException(
        `Inventory reservation with ID ${reservationId} not found`,
      );
    }

    return this.toResponse(reservation);
  }

  private async transitionReservation(
    reservationId: string,
    targetStatus:
      | typeof InventoryReservationStatus.RELEASED
      | typeof InventoryReservationStatus.CONSUMED,
  ) {
    this.logger.log(
      `Transitioning inventory reservation ${reservationId} to ${targetStatus}`,
    );

    const reservation = await this.prisma.client.$transaction(
      async (transaction) => {
        const lockedReservation = await transaction.$queryRaw<
          Array<{ id: string }>
        >`SELECT "id" FROM "InventoryReservation" WHERE "id" = ${reservationId} FOR UPDATE`;

        if (lockedReservation.length === 0) {
          throw new NotFoundException(
            `Inventory reservation with ID ${reservationId} not found`,
          );
        }

        const current =
          await transaction.inventoryReservation.findUniqueOrThrow({
            where: { id: reservationId },
            include: reservationDetailsInclude,
          });

        if (current.status === targetStatus) {
          return current;
        }

        if (current.status !== InventoryReservationStatus.ACTIVE) {
          throw new ConflictException(
            `Inventory reservation is already ${current.status.toLowerCase()}`,
          );
        }

        if (
          targetStatus === InventoryReservationStatus.CONSUMED &&
          current.expiresAt <= new Date()
        ) {
          throw new ConflictException('Inventory reservation has expired');
        }

        const inventories = await this.lockInventoryRows(
          transaction,
          current.items.map(({ inventoryId }) => inventoryId),
        );
        const inventoryById = new Map(
          inventories.map((inventory) => [inventory.id, inventory]),
        );

        for (const item of current.items) {
          const inventory = inventoryById.get(item.inventoryId);

          if (!inventory) {
            throw new ConflictException(
              `Inventory ${item.inventoryId} referenced by the reservation is missing`,
            );
          }

          if (
            inventory.reserved < item.quantity ||
            (targetStatus === InventoryReservationStatus.CONSUMED &&
              inventory.quantity < item.quantity)
          ) {
            throw new ConflictException(
              `Inventory ${item.inventoryId} quantities are inconsistent with the reservation`,
            );
          }

          const result = await transaction.inventory.updateMany({
            where: {
              id: item.inventoryId,
              reserved: { gte: item.quantity },
              ...(targetStatus === InventoryReservationStatus.CONSUMED && {
                quantity: { gte: item.quantity },
              }),
            },
            data: {
              reserved: { decrement: item.quantity },
              ...(targetStatus === InventoryReservationStatus.CONSUMED && {
                quantity: { decrement: item.quantity },
              }),
            },
          });

          if (result.count !== 1) {
            throw new ConflictException(
              `Inventory ${item.inventoryId} changed during reservation transition`,
            );
          }
        }

        return transaction.inventoryReservation.update({
          where: { id: reservationId },
          data: { status: targetStatus },
          include: reservationDetailsInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    return this.toResponse(reservation);
  }

  private async lockInventoryRows(
    transaction: Prisma.TransactionClient,
    inventoryIds: string[],
  ) {
    if (inventoryIds.length === 0) {
      throw new BadRequestException('At least one inventory item is required');
    }

    const sortedIds = [...inventoryIds].sort();

    return transaction.$queryRaw<LockedInventoryRow[]>(Prisma.sql`
      SELECT
        inventory."id",
        inventory."quantity",
        inventory."reserved",
        warehouse."isActive" AS "warehouseIsActive"
      FROM "Inventory" AS inventory
      INNER JOIN "Warehouse" AS warehouse
        ON warehouse."id" = inventory."warehouseId"
      WHERE inventory."id" IN (${Prisma.join(sortedIds)})
      ORDER BY inventory."id"
      FOR UPDATE OF inventory
    `);
  }

  private assertCanReserve(
    inventories: LockedInventoryRow[],
    items: ReserveInventoryDto['items'],
  ) {
    const inventoryById = new Map(
      inventories.map((inventory) => [inventory.id, inventory]),
    );

    for (const item of items) {
      const inventory = inventoryById.get(item.inventoryId);

      if (!inventory) {
        throw new NotFoundException(
          `Inventory with ID ${item.inventoryId} not found`,
        );
      }

      if (!inventory.warehouseIsActive) {
        throw new ConflictException(
          `Warehouse for inventory ${item.inventoryId} is inactive`,
        );
      }

      if (inventory.quantity - inventory.reserved < item.quantity) {
        throw new ConflictException(
          `Insufficient available stock for inventory ${item.inventoryId}`,
        );
      }
    }
  }

  private assertSameReserveRequest(
    reservation: ReservationDetails,
    requestedItems: ReserveInventoryDto['items'],
  ) {
    const existingItems = [...reservation.items].sort((left, right) =>
      left.inventoryId.localeCompare(right.inventoryId),
    );

    const matches =
      existingItems.length === requestedItems.length &&
      existingItems.every(
        (item, index) =>
          item.inventoryId === requestedItems[index]?.inventoryId &&
          item.quantity === requestedItems[index]?.quantity,
      );

    if (!matches) {
      throw new ConflictException(
        'Idempotency key is already used for a different reservation request',
      );
    }
  }

  private findByIdempotencyKey(
    client: Prisma.TransactionClient,
    idempotencyKey: string,
  ) {
    return client.inventoryReservation.findUnique({
      where: { idempotencyKey },
      include: reservationDetailsInclude,
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private toResponse(reservation: ReservationDetails) {
    return {
      ...reservation,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
    };
  }
}
