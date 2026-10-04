import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InventoryReservationExpiryService } from '../modules/inventory-reservation/inventory-reservation-expiry.service';
import { PrismaModule } from '../prisma/prisma.module';

const BATCH_SIZE = 100;

@Module({
  imports: [PrismaModule],
  providers: [InventoryReservationExpiryService],
})
class InventoryReservationsExpiryJobModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(
    InventoryReservationsExpiryJobModule,
    {
      logger: ['error', 'warn'],
      abortOnError: false,
    },
  );

  try {
    const expiryService = app.get(InventoryReservationExpiryService);
    let expiredCount = 0;
    let batchCount: number;

    do {
      batchCount = await expiryService.expireDueReservations(BATCH_SIZE);
      expiredCount += batchCount;
    } while (batchCount === BATCH_SIZE);

    console.log(
      JSON.stringify({ event: 'inventory-reservations-expired', expiredCount }),
    );
  } finally {
    await app.close();
  }
}

void main().catch(() => {
  // Prisma errors may contain connection details, so keep the public log generic.
  console.error(
    'Inventory reservation expiry failed. Check database access and reservation consistency.',
  );
  process.exitCode = 1;
});
