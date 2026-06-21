-- ProductVariant becomes the only sellable entity. Existing product-level
-- commerce records are assigned to one default variant per product.

ALTER TABLE "ProductVariant"
ADD COLUMN "slug" TEXT,
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Give existing variants stable globally unique slugs derived from their SKU.
UPDATE "ProductVariant" AS variant
SET "slug" = product."slug" || '-' || trim(both '-' from lower(
  regexp_replace(variant."sku", '[^a-zA-Z0-9]+', '-', 'g')
))
FROM "Product" AS product
WHERE product."id" = variant."productId";

WITH duplicate_slugs AS (
  SELECT "slug"
  FROM "ProductVariant"
  GROUP BY "slug"
  HAVING count(*) > 1
)
UPDATE "ProductVariant" AS variant
SET "slug" = variant."slug" || '-' || substr(md5(variant."id"), 1, 8)
FROM duplicate_slugs AS duplicate
WHERE variant."slug" = duplicate."slug";

-- Products created under the previous model may not have any variants.
INSERT INTO "ProductVariant" (
  "id",
  "slug",
  "sku",
  "name",
  "volumeMl",
  "weightG",
  "isDefault",
  "isActive",
  "createdAt",
  "updatedAt",
  "productId"
)
SELECT
  substr(md5('default-variant:' || product."id"), 1, 8) || '-' ||
    substr(md5('default-variant:' || product."id"), 9, 4) || '-' ||
    '4' || substr(md5('default-variant:' || product."id"), 14, 3) || '-' ||
    'a' || substr(md5('default-variant:' || product."id"), 18, 3) || '-' ||
    substr(md5('default-variant:' || product."id"), 21, 12),
  product."slug" || CASE
    WHEN product."volumeMl" IS NOT NULL THEN '-' || product."volumeMl" || 'ml'
    WHEN product."weightG" IS NOT NULL THEN '-' || product."weightG" || 'g'
    ELSE '-default'
  END,
  upper(product."slug") || CASE
    WHEN product."volumeMl" IS NOT NULL THEN '-' || product."volumeMl" || 'ML'
    WHEN product."weightG" IS NOT NULL THEN '-' || product."weightG" || 'G'
    ELSE '-DEFAULT'
  END,
  CASE
    WHEN product."volumeMl" IS NOT NULL THEN product."volumeMl" || ' ml'
    WHEN product."weightG" IS NOT NULL THEN product."weightG" || ' g'
    ELSE 'Default'
  END,
  product."volumeMl",
  product."weightG",
  true,
  product."isActive",
  product."createdAt",
  product."updatedAt",
  product."id"
FROM "Product" AS product
WHERE NOT EXISTS (
  SELECT 1
  FROM "ProductVariant" AS variant
  WHERE variant."productId" = product."id"
);

-- Select exactly one default for products that already had variants.
WITH ranked_variants AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "productId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS position
  FROM "ProductVariant"
)
UPDATE "ProductVariant" AS variant
SET "isDefault" = ranked.position = 1
FROM ranked_variants AS ranked
WHERE ranked."id" = variant."id";

-- Preserve legacy product dimensions when existing variants did not override them.
UPDATE "ProductVariant" AS variant
SET
  "volumeMl" = coalesce(variant."volumeMl", product."volumeMl"),
  "weightG" = coalesce(variant."weightG", product."weightG")
FROM "Product" AS product
WHERE variant."productId" = product."id";

DROP INDEX "Price_productId_idx";
DROP INDEX "Price_productId_isValidFrom_isValidTo_idx";
ALTER TABLE "Price" DROP CONSTRAINT "Price_productId_fkey";

UPDATE "Price" AS price
SET "variantId" = variant."id"
FROM "ProductVariant" AS variant
WHERE price."variantId" IS NULL
  AND price."productId" = variant."productId"
  AND variant."isDefault" = true;

ALTER TABLE "Price"
ALTER COLUMN "variantId" SET NOT NULL,
DROP COLUMN "productId";

CREATE INDEX "Price_variantId_isValidFrom_isValidTo_idx"
ON "Price"("variantId", "isValidFrom", "isValidTo");

DROP INDEX "Inventory_productId_variantId_warehouseId_key";
DROP INDEX "Inventory_productId_idx";
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_productId_fkey";

UPDATE "Inventory" AS inventory
SET "variantId" = variant."id"
FROM "ProductVariant" AS variant
WHERE inventory."variantId" IS NULL
  AND inventory."productId" = variant."productId"
  AND variant."isDefault" = true;

-- Merge possible product-level and variant-level stock rows for one warehouse.
WITH duplicate_inventory AS (
  SELECT
    min("id") AS keeper_id,
    "variantId",
    "warehouseId",
    sum("quantity") AS quantity,
    sum("reserved") AS reserved,
    sum("incoming") AS incoming
  FROM "Inventory"
  GROUP BY "variantId", "warehouseId"
  HAVING count(*) > 1
)
UPDATE "Inventory" AS inventory
SET
  "quantity" = duplicate.quantity,
  "reserved" = duplicate.reserved,
  "incoming" = duplicate.incoming
FROM duplicate_inventory AS duplicate
WHERE inventory."id" = duplicate.keeper_id;

WITH ranked_inventory AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "variantId", "warehouseId"
      ORDER BY "id" ASC
    ) AS position
  FROM "Inventory"
)
DELETE FROM "Inventory" AS inventory
USING ranked_inventory AS ranked
WHERE inventory."id" = ranked."id"
  AND ranked.position > 1;

ALTER TABLE "Inventory"
ALTER COLUMN "variantId" SET NOT NULL,
DROP COLUMN "productId";

CREATE UNIQUE INDEX "Inventory_variantId_warehouseId_key"
ON "Inventory"("variantId", "warehouseId");

ALTER TABLE "ProductImage"
ADD COLUMN "variantId" TEXT;

CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

CREATE UNIQUE INDEX "ProductVariant_id_productId_key"
ON "ProductVariant"("id", "productId");

ALTER TABLE "ProductImage"
ADD CONSTRAINT "ProductImage_variantId_fkey"
FOREIGN KEY ("variantId", "productId")
REFERENCES "ProductVariant"("id", "productId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product"
DROP COLUMN "volumeMl",
DROP COLUMN "weightG";

ALTER TABLE "ProductVariant" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "ProductVariant_slug_key" ON "ProductVariant"("slug");
CREATE INDEX "ProductVariant_slug_idx" ON "ProductVariant"("slug");

-- PostgreSQL partial unique index: at most one default variant per product.
CREATE UNIQUE INDEX "ProductVariant_one_default_per_product"
ON "ProductVariant"("productId")
WHERE "isDefault" = true;
