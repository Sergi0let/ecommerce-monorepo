# Де продовжуємо API

Наступний етап — **операції резервування залишків**.
Повний залишок roadmap — у [api-plan.md](./api-plan.md).
Після завершення задачі видаляємо її звідси, а бізнес-користь і взаємодії
фіксуємо в [журналі фіч](./_feature-api.md).

## 1. Inventory operations — атомарне резервування

Наявний `Inventory` CRUD дозволяє менеджеру напряму змінювати `quantity` і
`reserved`. Перед кошиком і checkout потрібні окремі бізнес-операції, які
захищають від продажу понад доступний залишок та конкурентних запитів.

Перший вертикальний зріз:

- визначити операції `reserve`, `release` і `consume`, їхні входи,
  ідемпотентність та дозволені переходи;
- атомарно перевіряти доступність `quantity - reserved` і змінювати залишок;
- не дозволяти звичайному inventory update обходити активні резерви;
- додати інтеграційні тести на нестачу залишку, повтор запиту та паралельне
  резервування однієї позиції.

Працювати з `variantId + warehouseId`: залишок і ціна належать варіанту.
Деталі інваріантів — у [warehouse-domain.md](./warehouse-domain.md) та
[product-pricing.md](./product-pricing.md). Повний перелік — у
[roadmap, розділ Inventory operations](./api-plan.md#1-inventory-operations).

```text
apps/api/src/modules/inventory/          # Бізнес-операції залишків
packages/contracts/src/inventory/        # Inputs і response contracts за потреби
apps/api/test/                            # Тести конкуренції й інваріантів
```

## 2. Далі за залежностями

Після inventory operations: Cart → Orders / checkout → Payments → Search /
filters. Cart не резервує залишки сам по собі; checkout має створити замовлення
та резерв в узгодженому сценарії. Production-задачі виконати до запуску за
[окремим розділом roadmap](./api-plan.md#5-перед-публічним-production-запуском).

## Перевірка змін

- Після зміни contracts: `pnpm --filter @repo/contracts build`.
- Для API: `pnpm --filter api check-types`, `pnpm --filter api lint`,
  релевантні e2e та `pnpm --filter api build`.
- E2E виконувати з окремою `TEST_DATABASE_URL` за
  [інструкцією тестового середовища](../apps/api/test/test-register.md).
- Якщо етап вимагає зміни Prisma schema —
  [міграція та генерація клієнта](./db-migration-flow.md).
