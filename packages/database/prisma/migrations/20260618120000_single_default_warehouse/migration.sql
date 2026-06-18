WITH ranked_defaults AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS row_number
  FROM "Warehouse"
  WHERE "isDefault" = true
)
UPDATE "Warehouse"
SET "isDefault" = false
WHERE "id" IN (
  SELECT "id"
  FROM ranked_defaults
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "Warehouse_single_default_key"
ON "Warehouse"("isDefault")
WHERE "isDefault" = true;
