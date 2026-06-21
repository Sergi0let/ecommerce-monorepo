# Warehouse domain

`Warehouse` описує місце зберігання, а `Inventory` зберігає кількість
конкретного `ProductVariant` на цьому складі.

## Модель

```prisma
model Warehouse {
  id        String  @id @default(uuid())
  name      String
  code      String  @unique
  address   String?
  isDefault Boolean @default(false)
  isActive  Boolean @default(true)

  inventory Inventory[]
}

model Inventory {
  id          String @id @default(uuid())
  variantId   String
  warehouseId String

  quantity Int @default(0)
  reserved Int @default(0)
  incoming Int @default(0)

  location    String?
  batchNumber String?
  expiresAt   DateTime?

  variant   ProductVariant @relation(fields: [variantId], references: [id])
  warehouse Warehouse      @relation(fields: [warehouseId], references: [id])

  @@unique([variantId, warehouseId])
}
```

## Правила

- `Product` не має власного залишку.
- `variantId` є обов'язковим, навіть коли продукт має лише один варіант.
- Для пари `variantId + warehouseId` існує не більше одного запису.
- Доступна кількість для продажу: `quantity - reserved`.
- `incoming` показує очікуване надходження і не входить у доступний залишок.

Приклад:

| Warehouse      | Variant                 | Quantity | Reserved | Available |
| -------------- | ----------------------- | -------: | -------: | --------: |
| Основний склад | `cerave-cleanser-236ml` |       20 |        2 |        18 |
| Основний склад | `cerave-cleanser-473ml` |        8 |        1 |         7 |
| Склад Львів    | `cerave-cleanser-236ml` |        5 |        0 |         5 |

`Warehouse.isDefault` визначає склад за замовчуванням. У PostgreSQL частковий
unique index гарантує, що default-склад може бути лише один.
