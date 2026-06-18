import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWarehouseDto) {
    this.logger.log(`Creating WAREHOUSE ${data.name} with ${data.code}`);

    const createWarehouse = this.prisma.client.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        isDefault: data.isDefault,
        isActive: data.isActive,
      },
    });

    if (!data.isDefault) {
      return createWarehouse;
    }

    return this.prisma.client
      .$transaction([
        this.prisma.client.warehouse.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        }),
        createWarehouse,
      ])
      .then(([, warehouse]) => warehouse);
  }

  async updateById(id: string, data: UpdateWarehouseDto) {
    this.logger.log(
      `Updating WAREHOUSE ${id} with data ${JSON.stringify(data)}`,
    );

    const updateWarehouse = this.prisma.client.warehouse.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        isDefault: data.isDefault,
        isActive: data.isActive,
      },
    });

    if (data.isDefault !== true) {
      return updateWarehouse;
    }

    return this.prisma.client
      .$transaction([
        this.prisma.client.warehouse.updateMany({
          where: {
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        }),
        updateWarehouse,
      ])
      .then(([, warehouse]) => warehouse);
  }

  async delete(id: string) {
    this.logger.log(`Deleting warehouse ${id}`);

    // const warehouse = await this.prisma.client.warehouse.findUnique({
    //   where: { id },
    //   include: {
    //     _count: { select: { inventory } },
    //   },
    // });
    this.prisma.client.warehouse.delete({
      where: { id },
    });
  }

  async getAll(query: WarehouseQueryDto) {
    const { limit = 10, page = 1, sort = 'desc', isActive, isDefault } = query;

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const where = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(isDefault !== undefined ? { isDefault } : {}),
    };

    const [warehouses, total] = await Promise.all([
      this.prisma.client.warehouse.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: sort },
      }),
      this.prisma.client.warehouse.count({ where }),
    ]);

    return {
      data: warehouses,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }
  async getById(id: string) {
    const warehouse = await this.prisma.client.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ${id} not found`);
    }

    return warehouse;
  }
}
