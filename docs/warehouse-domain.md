# Warehouse domain

`Warehouse` - це сутність складу або точки зберігання товарів.

Вона відповідає на питання: **де зберігається товар?**

Сам склад не зберігає кількість товарів напряму. Для цього є окрема сутність `Inventory`, яка зв'язує склад з конкретним товаром або варіантом товару.

## Warehouse

```prisma
model Warehouse {
  id        String  @id @default(uuid())
  name      String
  code      String  @unique
  address   String?
  isDefault Boolean @default(false)
  isActive  Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  inventory Inventory[]

  @@index([isDefault])
  @@index([code])
  @@index([isActive])
}
```

## Поля

`id` - унікальний ідентифікатор складу. Генерується автоматично як UUID.

`name` - назва складу, наприклад `Основний склад` або `Склад Київ`.

`code` - унікальний код складу, наприклад `MAIN` або `KYIV_01`. Поле має `@unique`, тому два склади з однаковим кодом створити не можна.

`address` - адреса складу. Поле опціональне.

`isDefault` - позначає склад за замовчуванням. Його можна використовувати, коли склад явно не вибраний.

`isActive` - позначає, чи активний склад. Якщо `false`, склад можна приховати з вибору, але залишити історичні дані.

`createdAt` - дата створення запису.

`updatedAt` - дата останнього оновлення запису. Оновлюється автоматично.

## Зв'язки

```prisma
inventory Inventory[]
```

Це зв'язок **один-до-багатьох**:

один `Warehouse` може мати багато записів `Inventory`.

`Inventory` зберігає залишки товарів на конкретному складі:

```prisma
model Inventory {
  id          String  @id @default(uuid())
  productId   String
  variantId   String?
  warehouseId String

  quantity Int @default(0)
  reserved Int @default(0)
  incoming Int @default(0)

  product   Product?
  variant   ProductVariant?
  warehouse Warehouse
}
```

Практична модель:

- `Warehouse` - де зберігаємо.
- `Product` - який товар.
- `ProductVariant` - який варіант товару, наприклад 50 мл або 100 мл.
- `Inventory` - скільки конкретного товару або варіанту є на конкретному складі.

Приклад:

| Warehouse | Product | Variant | Quantity |
| --- | --- | --- | --- |
| Основний склад | Крем | 50 мл | 20 |
| Основний склад | Крем | 100 мл | 8 |
| Склад Львів | Крем | 50 мл | 5 |

## Обмеження та індекси

```prisma
@@index([isDefault])
@@index([code])
@@index([isActive])
```

Індекси потрібні для швидкого пошуку:

- складу за `code`;
- активних складів;
- складу за замовчуванням.

Важлива деталь: `code` вже має `@unique`, тому для PostgreSQL окремий `@@index([code])` зазвичай зайвий, бо unique constraint і так створює індекс.

У `Inventory` є обмеження:

```prisma
@@unique([productId, variantId, warehouseId])
```

Воно означає, що для однієї комбінації `productId`, `variantId` і `warehouseId` має бути тільки один запис залишку.

Тобто не повинно бути двох різних рядків, які описують один і той самий товар або варіант на одному й тому самому складі.
