/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Attribute` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ProductImage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[brandId,slug]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - Made the column `updatedAt` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Warehouse` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Attribute" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "brandId" TEXT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Warehouse" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Category_brandId_idx" ON "Category"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_brandId_slug_key" ON "Category"("brandId", "slug");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
