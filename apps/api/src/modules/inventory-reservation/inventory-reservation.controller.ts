import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@repo/contracts';
import { ZodSerializerDto } from 'nestjs-zod';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { ConsumeInventoryReservationDto } from './dto/consume-inventory-reservation.dto';
import { InventoryReservationDto } from './dto/inventory-reservation.dto';
import { ReleaseInventoryReservationDto } from './dto/release-inventory-reservation.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { InventoryReservationService } from './inventory-reservation.service';

@ApiTags('Inventory reservations')
@Controller('inventory-reservations')
@RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
export class InventoryReservationController {
  constructor(
    private readonly inventoryReservationService: InventoryReservationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ZodSerializerDto(InventoryReservationDto)
  @ApiOperation({ summary: 'Reserve inventory atomically' })
  @ApiResponse({ status: 201, type: InventoryReservationDto })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  @ApiResponse({ status: 409, description: 'Stock cannot be reserved' })
  reserve(@Body() data: ReserveInventoryDto) {
    return this.inventoryReservationService.reserve(data);
  }

  @Post(':reservationId/release')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(InventoryReservationDto)
  @ApiOperation({ summary: 'Release an active inventory reservation' })
  @ApiParam({ name: 'reservationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: InventoryReservationDto })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  release(@Param() { reservationId }: ReleaseInventoryReservationDto) {
    return this.inventoryReservationService.release(reservationId);
  }

  @Post(':reservationId/consume')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(InventoryReservationDto)
  @ApiOperation({ summary: 'Consume an active inventory reservation' })
  @ApiParam({ name: 'reservationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: InventoryReservationDto })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  consume(@Param() { reservationId }: ConsumeInventoryReservationDto) {
    return this.inventoryReservationService.consume(reservationId);
  }

  @Get(':reservationId')
  @ZodSerializerDto(InventoryReservationDto)
  @ApiOperation({ summary: 'Get an inventory reservation by ID' })
  @ApiParam({ name: 'reservationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: InventoryReservationDto })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  getById(@Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.inventoryReservationService.getById(reservationId);
  }
}
