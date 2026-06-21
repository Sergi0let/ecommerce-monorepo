/*
  Warnings:

  - You are about to drop the column `productId` on the `Inventory` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Price` table. All the data in the column will be lost.
  - You are about to drop the column `volumeMl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `weightG` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[variantId,warehouseId]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,productId]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - Made the column `variantId` on table `Inventory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `variantId` on table `Price` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `slug` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_productId_fkey";

-- DropForeignKey
ALTER TABLE "Price" DROP CONSTRAINT "Price_productId_fkey";

-- DropIndex
DROP INDEX "Inventory_productId_idx";

-- DropIndex
DROP INDEX "Inventory_productId_variantId_warehouseId_key";

-- DropIndex
DROP INDEX "Price_productId_idx";

-- DropIndex
DROP INDEX "Price_productId_isValidFrom_isValidTo_idx";

-- AlterTable
ALTER TABLE "Inventory" DROP COLUMN "productId",
ALTER COLUMN "variantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Price" DROP COLUMN "productId",
ALTER COLUMN "variantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "volumeMl",
DROP COLUMN "weightG";

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_variantId_warehouseId_key" ON "Inventory"("variantId", "warehouseId");

-- CreateIndex
CREATE INDEX "Price_variantId_isValidFrom_isValidTo_idx" ON "Price"("variantId", "isValidFrom", "isValidTo");

-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_slug_key" ON "ProductVariant"("slug");

-- CreateIndex
CREATE INDEX "ProductVariant_slug_idx" ON "ProductVariant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_id_productId_key" ON "ProductVariant"("id", "productId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ProductVariant"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;
