-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "InventoryReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_idempotencyKey_key" ON "InventoryReservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservationItem_inventoryId_idx" ON "InventoryReservationItem"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservationItem_reservationId_inventoryId_key" ON "InventoryReservationItem"("reservationId", "inventoryId");

-- AddForeignKey
ALTER TABLE "InventoryReservationItem" ADD CONSTRAINT "InventoryReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservationItem" ADD CONSTRAINT "InventoryReservationItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
