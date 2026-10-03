ALTER TABLE "InventoryReservationItem"
ADD CONSTRAINT "InventoryReservationItem_quantity_positive_check"
CHECK ("quantity" > 0);
