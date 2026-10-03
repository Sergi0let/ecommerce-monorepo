# Inventory reservations

Цей документ пояснює, навіщо потрібні `InventoryReservation` та
`InventoryReservationItem`, як вони пов'язані з `Inventory` і як мають
працювати майбутні операції `reserve`, `release`, `consume` та `expire`.

## Проста історія

Уявімо, що магазин продає сині чашки. На складі в Києві лежить 10 чашок:

```text
Inventory
quantity = 10
reserved = 0
available = quantity - reserved = 10
```

Анна починає checkout і хоче купити дві чашки. Система створює загальний
резерв:

```text
InventoryReservation
id = reservation-123
status = ACTIVE
expiresAt = через 15 хвилин
```

Сам резерв описує життєвий цикл, але не конкретний товар. Товар і кількість
записуються окремою позицією:

```text
InventoryReservationItem
reservationId = reservation-123
inventoryId = сині чашки, склад Київ
quantity = 2
```

Одночасно система змінює складський агрегат:

```text
Inventory
quantity = 10
reserved = 2
available = 8
```

Фізично на складі все ще є 10 чашок, але дві тимчасово недоступні іншим
покупцям.

## Відповідальність моделей

### `Inventory`

Зберігає фізичний залишок конкретного SKU на конкретному складі. Один запис
належить унікальній парі `variantId + warehouseId`.

```text
quantity  — фізична кількість;
reserved  — сума одиниць в активних резервах;
incoming  — очікуване надходження, не доступне для продажу;
available — quantity - reserved, обчислюване значення.
```

Inventory належить `ProductVariant`, а не безпосередньо `Product`, тому що саме
варіант є конкретним SKU, який продається.

### `InventoryReservation`

Це заголовок одного резерву. Він зберігає:

- `status` — поточний стан;
- `idempotencyKey` — захист від повторного виконання тієї самої команди;
- `expiresAt` — момент автоматичного завершення резерву;
- `createdAt` і `updatedAt` — час створення та останньої зміни;
- `items` — позиції товарів у резерві.

Поточна модель ще не зберігає `userId`, `cartId` або `orderId`. Після появи
Orders власника доцільно визначати через зв'язок `Reservation -> Order -> User`,
а не дублювати користувача в кожній позиції.

### `InventoryReservationItem`

Це конкретний рядок резерву: який `Inventory` і скільки його одиниць
зарезервовано.

```text
InventoryReservation
├── Item: синя чашка, Київ, quantity = 2
└── Item: біла тарілка, Київ, quantity = 1
```

Пара `reservationId + inventoryId` унікальна, тому один складський запис не
повторюється двічі в межах одного резерву. `quantity` має бути цілим числом,
більшим за нуль.

## Життєвий цикл

Новий резерв створюється зі статусом `ACTIVE`. Дозволені переходи:

```text
ACTIVE -> RELEASED
ACTIVE -> CONSUMED
ACTIVE -> EXPIRED
```

`RELEASED`, `CONSUMED` і `EXPIRED` є кінцевими станами. Повторна команда не
повинна вдруге змінювати залишок.

### Що означає кожен статус

#### `ACTIVE`

Резерв створений і зараз утримує товар для checkout. Кількість усіх його
позицій уже входить у `Inventory.reserved`, тому інші покупці її не бачать як
доступну.

Приклад: Анна зарезервувала дві чашки й має 15 хвилин для завершення checkout.

```text
Inventory.quantity = 10
Inventory.reserved = 2
Reservation.status = ACTIVE
```

Лише з `ACTIVE` дозволені переходи в `RELEASED`, `CONSUMED` або `EXPIRED`.

#### `RELEASED`

Резерв скасований явною бізнес-операцією. Наприклад, користувач скасував
checkout або замовлення. Товар не продано, тому `Inventory.quantity` не
змінюється, а `Inventory.reserved` зменшується.

```text
Inventory.quantity = 10
Inventory.reserved: 2 -> 0
Reservation.status: ACTIVE -> RELEASED
```

#### `CONSUMED`

Резерв використаний для завершення продажу. Зарезервований товар списується і
з фізичної кількості, і з агрегованого резерву.

```text
Inventory.quantity: 10 -> 8
Inventory.reserved: 2 -> 0
Reservation.status: ACTIVE -> CONSUMED
```

Цей статус означає, що резерв уже виконав своє призначення і повторно
списувати товар не можна.

#### `EXPIRED`

Час `expiresAt` минув до завершення checkout. Cleanup-процес автоматично
звільняє товар: фізична кількість не змінюється, а резерв повертається в
доступний залишок.

```text
Inventory.quantity = 10
Inventory.reserved: 2 -> 0
Reservation.status: ACTIVE -> EXPIRED
```

`EXPIRED` відрізняється від `RELEASED` причиною завершення: `RELEASED`
створюється явною командою, а `EXPIRED` — автоматично після завершення TTL.

### `reserve`

Перед створенням резерву система перевіряє:

```text
available = quantity - reserved
available >= requested quantity
```

Після успіху створюються reservation та items, а `Inventory.reserved`
збільшується на кількість кожної позиції.

```text
reserved = reserved + item.quantity
```

### `release`

Використовується при скасуванні checkout або замовлення:

```text
status: ACTIVE -> RELEASED
reserved = reserved - item.quantity
quantity не змінюється
```

### `consume`

Використовується, коли зарезервований товар остаточно списується зі складу:

```text
status: ACTIVE -> CONSUMED
reserved = reserved - item.quantity
quantity = quantity - item.quantity
```

Доступний залишок під час consume не змінюється: товар уже був недоступний
іншим покупцям через резерв.

### `expire`

Якщо активний резерв не завершили до `expiresAt`, cleanup-процес переводить
його в `EXPIRED` і звільняє всі позиції так само, як `release`.

## Атомарність

Створення reservation, створення items і зміна `Inventory.reserved` мають
виконуватися в одній транзакції PostgreSQL. Для резерву з кількома позиціями
операція або завершується повністю, або повністю відкочується.

```text
BEGIN
  lock Inventory rows у стабільному порядку
  перевірити доступність усіх позицій
  створити InventoryReservation
  створити InventoryReservationItem[]
  оновити Inventory.reserved
COMMIT
```

Без row locking або conditional update два паралельні checkout можуть продати
останні одиниці одночасно.

## Ідемпотентність

`idempotencyKey` є унікальним. Якщо клієнт повторить той самий запит через
timeout або мережеву помилку, API має повернути вже створений резерв, а не
збільшувати `reserved` повторно.

Те саме правило стосується `release`, `consume` та `expire`: terminal status
не дозволяє повторно застосувати зміну залишку.

## Зв'язок із Cart та Checkout

Додавання товару в Cart не створює резерв. Інакше покинуті кошики блокували б
залишки.

```text
Add to Cart       -> резерву немає
Start Checkout    -> reserve
Cancel / timeout  -> release або expire
Payment success   -> consume
```

Після появи Orders точний момент `consume` потрібно узгодити з payment flow:
успішний redirect із платіжної сторінки сам по собі не підтверджує оплату.

## Інваріанти

- резервується конкретний `Inventory`, тобто конкретні `variantId + warehouseId`;
- `InventoryReservationItem.quantity > 0`;
- `Inventory.reserved >= 0`;
- `Inventory.reserved <= Inventory.quantity`;
- `incoming` не використовується під час перевірки доступності;
- один reservation не містить той самий `inventoryId` двічі;
- сума активних reservation items має відповідати `Inventory.reserved`;
- статус і залишки змінюються однією транзакцією;
- Cart самостійно не резервує товар.

## Політика видалення

Поточний relation `InventoryReservationItem -> Inventory` використовує
`onDelete: Restrict`. Після появи reservation item відповідний Inventory не
можна фізично видалити, навіть якщо резерв завершений. Це зберігає історію,
але означає, що перед production-підключенням потрібно узгодити hard delete з
retention policy або перейти на archive/soft delete.

## Обов'язкові тести

- недостатній доступний залишок;
- два паралельні reserve на останню одиницю;
- повторний reserve з тим самим `idempotencyKey`;
- multi-item reserve повністю відкочується при помилці однієї позиції;
- повторний release, consume або expire не змінює залишок вдруге;
- release після consume та consume після release відхиляються;
- expiry звільняє всі позиції рівно один раз;
- admin update не зменшує `quantity` нижче `reserved`.
