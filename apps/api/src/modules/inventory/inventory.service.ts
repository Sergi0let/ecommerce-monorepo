import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInventoryDto) {
    this.logger.log(
      `Creating inventory for variant ${data.variantId} in warehouse ${data.warehouseId}`,
    );

    await this.assertVariantExistsById(data.variantId);
    await this.assertWarehouseExistsById(data.warehouseId);
    await this.assertInventoryPairAvailable(data.variantId, data.warehouseId);

    try {
      return await this.prisma.client.inventory.create({
        data: {
          variantId: data.variantId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          reserved: data.reserved,
          incoming: data.incoming,
          location: data.location,
          batchNumber: data.batchNumber,
          expiresAt: this.toDateOrUndefined(data.expiresAt),
          lastCountedAt: this.toDateOrUndefined(data.lastCountedAt),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Inventory for this variant and warehouse already exists',
        );
      }

      throw error;
    }
  }

  async updateById(id: string, data: UpdateInventoryDto) {
    this.logger.log(
      `Updating inventory ${id} with data ${JSON.stringify(data)}`,
    );

    const inventory = await this.getById(id);
    const quantity = data.quantity ?? inventory.quantity;
    const reserved = data.reserved ?? inventory.reserved;

    if (reserved > quantity) {
      throw new BadRequestException(
        'reserved must be less than or equal to quantity',
      );
    }

    return this.prisma.client.inventory.update({
      where: { id },
      data: {
        quantity: data.quantity,
        reserved: data.reserved,
        incoming: data.incoming,
        location: data.location,
        batchNumber: data.batchNumber,
        expiresAt: this.toDateOrUndefined(data.expiresAt),
        lastCountedAt: this.toDateOrUndefined(data.lastCountedAt),
      },
    });
  }

  async delete(id: string) {
    this.logger.log(`Deleting inventory ${id}`);

    await this.getById(id);

    return this.prisma.client.inventory.delete({ where: { id } });
  }

  async getById(id: string) {
    const inventory = await this.prisma.client.inventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }

    return inventory;
  }

  async getByProductId(id: string) {
    const inventory = await this.prisma.client.productVariant.findUnique({
      where: { id },
      select: {
        inventory: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return inventory.inventory;
  }

  private async assertInventoryPairAvailable(
    variantId: string,
    warehouseId: string,
  ) {
    const inventory = await this.prisma.client.inventory.findUnique({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      select: { id: true },
    });

    if (inventory) {
      throw new ConflictException(
        'Inventory for this variant and warehouse already exists',
      );
    }
  }

  private async assertVariantExistsById(id: string) {
    const variant = await this.prisma.client.productVariant.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }
  }

  private async assertWarehouseExistsById(id: string) {
    const warehouse = await this.prisma.client.warehouse.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
  }

  private toDateOrUndefined(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    return value === null ? null : new Date(value);
  }
}
