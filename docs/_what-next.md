# Де продовжуємо API

Наступний етап — **Cart для авторизованого користувача**.
Повний залишок roadmap — у [api-plan.md](./api-plan.md). Завершені Inventory
Reservations зафіксовані в [журналі фіч](./_feature-api.md) і детально описані
в [inventory-reservations.md](./inventory-reservations.md).

## 1. Cart — перший вертикальний зріз

Cart зберігає намір покупця, але не резервує товар. Резерв створюватиметься
пізніше під час checkout, тому покинутий кошик не блокує складські залишки.

Мінімальний обсяг:

- моделі `Cart` і `CartItem` для авторизованого користувача;
- один активний кошик на користувача;
- позиція посилається на `ProductVariant`, а не на `Product`;
- додавання позиції, встановлення кількості, видалення позиції та очищення
  кошика;
- одна позиція для кожного variant у межах кошика;
- кількість — додатне ціле число з перевіркою в contracts і на рівні БД;
- ціна береться сервером з активного `Price`; клієнт не передає authoritative
  price, currency або totals;
- відповідь кошика показує поточну ціну й доступність, але не гарантує їх до
  checkout;
- ownership: користувач бачить і змінює тільки власний кошик;
- інтеграційні тести для ownership, повторного додавання variant, зміни
  кількості, видалення, неактивної ціни та відсутнього SKU.

Свідомо не входять у цей етап:

- guest cart та merge після login;
- резервування товару під час додавання в кошик;
- snapshots ціни й назви — вони належатимуть OrderItem;
- доставка, промокоди, checkout, Order і Payments.

```text
packages/database/prisma/schema.prisma       # Cart, CartItem
packages/contracts/src/cart/                 # inputs, views, responses, types
apps/api/src/modules/cart/                   # controller, service, dto, module
apps/api/test/cart.e2e-spec.ts               # ownership і бізнес-інваріанти
```

Рекомендовані тематичні коміти:

```text
feat(database): add cart models
feat(contracts): add cart contracts
feat(api): add authenticated cart operations
docs(api): document cart behavior
```

## 2. Після Cart

Наступна залежність — **Orders / checkout**. Checkout повторно перевіряє
активну ціну та доступний залишок, створює order snapshots і атомарно викликає
Inventory Reservation. Cart самостійно не викликає `reserve`.

Після Orders додаються Payments. Успішний redirect платіжної сторінки не є
підтвердженням оплати: остаточний перехід має спиратися на перевірений webhook.

Production-задачі, включно з Cron для expiry резервів, виконати до запуску за
[окремим розділом roadmap](./api-plan.md#4-перед-публічним-production-запуском).

## Перевірка змін

- Після зміни contracts: `pnpm --filter @repo/contracts build`.
- Для API: `pnpm --filter api check-types`, `pnpm --filter api lint`,
  релевантні e2e та `pnpm --filter api build`.
- E2E виконувати з окремою `TEST_DATABASE_URL` за
  [інструкцією тестового середовища](../apps/api/test/test-register.md).
- Після зміни Prisma schema пройти
  [migration workflow](./db-migration-flow.md).
