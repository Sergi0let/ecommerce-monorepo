/*
  Warnings:

  - You are about to drop the column `brandId` on the `Category` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_brandId_fkey";

-- DropIndex
DROP INDEX "Category_brandId_idx";

-- DropIndex
DROP INDEX "Category_brandId_slug_key";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "brandId";
