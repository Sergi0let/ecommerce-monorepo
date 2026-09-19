/*
  Warnings:

  - You are about to drop the column `url` on the `ProductImage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storageKeyBase]` on the table `ProductImage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `height` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `largeUrl` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mediumUrl` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storageKeyBase` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thumbnailUrl` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `ProductImage` table without a default value. This is not possible if the table is not empty.

*/
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ProductImage"
    WHERE "url" NOT LIKE 'https://placehold.co/%'
  ) THEN
    RAISE EXCEPTION
      'Migration stopped: ProductImage contains non-placeholder images';
  END IF;
END $$;

DELETE FROM "ProductImage"
WHERE "url" LIKE 'https://placehold.co/%';
-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "url",
ADD COLUMN     "height" INTEGER NOT NULL,
ADD COLUMN     "largeUrl" TEXT NOT NULL,
ADD COLUMN     "mediumUrl" TEXT NOT NULL,
ADD COLUMN     "storageKeyBase" TEXT NOT NULL,
ADD COLUMN     "thumbnailUrl" TEXT NOT NULL,
ADD COLUMN     "width" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_storageKeyBase_key" ON "ProductImage"("storageKeyBase");
COMMIT;