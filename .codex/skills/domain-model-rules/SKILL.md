---
name: domain-model-rules
description: Enforce core domain invariants for Product, ProductVariant, Price, Inventory, and Warehouse. Use when editing the Prisma schema, services, or contracts that touch products, variants, pricing, images, or stock.
---

# Доменні інваріанти

**Читай першим:** `docs/product-variants.md`, `docs/product-pricing.md`, `docs/warehouse-domain.md`

## Коли застосовувати

Будь-які зміни в моделі/логіці Product, Variant, Price, Inventory, Warehouse.

## Інваріанти

- `ProductVariant` — єдина **продавана** сутність; `Product` — контентний агрегат.
- **Ціна належить варіанту** (`Price.variantId`). Ціни рівня продукту не існує.
- Кожен SKU має власний `Price`, навіть за однакового значення (окрема історія).
- Активна ціна: `isValidFrom` ≤ now (або null) і `isValidTo` ≥ now (або null).
- **Inventory** належить парі `variantId + warehouseId` (не більше одного запису). Доступно = `quantity - reserved`; `incoming` не входить.
- Продукт створюється з ≥1 варіантом і має рівно один `isDefault: true`.
- `ProductVariant.slug` та `sku` глобально унікальні; `productId` варіанта незмінний; останній варіант не видаляти.
- `ProductImage.variantId = null` → спільне зображення продукту; інакше — конкретного варіанта.

## Перевірка

Зміни схеми → міграція (див. skill `db-migrations`) → `pnpm --filter api check-types`.
