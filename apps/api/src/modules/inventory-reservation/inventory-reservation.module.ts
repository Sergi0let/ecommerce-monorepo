import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryReservationController } from './inventory-reservation.controller';
import { InventoryReservationExpiryService } from './inventory-reservation-expiry.service';
import { InventoryReservationService } from './inventory-reservation.service';

@Module({
  controllers: [InventoryReservationController],
  providers: [
    InventoryReservationService,
    InventoryReservationExpiryService,
    JwtGuard,
    RolesGuard,
  ],
  exports: [InventoryReservationService, InventoryReservationExpiryService],
})
export class InventoryReservationModule {}
