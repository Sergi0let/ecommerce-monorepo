# Де продовжуємо API

Найближча робота — **Reviews**.
Повний залишок roadmap — у [api-plan.md](./api-plan.md).
Після завершення задачі видаляємо її звідси; історію виконаного не накопичуємо.

## 1. Наступна задача — Reviews

Перший крок — розширити `Review` у
[schema.prisma](../packages/database/prisma/schema.prisma): автор, статус
модерації та унікальність пари user/product. Спочатку перевірити, чи є дані
для перенесення; наявність моделі не означає готовий Reviews API.

Далі contracts → `ReviewsModule` → власні create/update/delete →
публічний paginated listing → moderation → узгоджений рейтинг продукту.
Правила та тестові сценарії — у [roadmap](./api-plan.md#1-reviews--наступний-новий-модуль).

Робочі файли для нового модуля:

```text
packages/database/prisma/schema.prisma   # Автор і статус відгуку
packages/contracts/src/reviews/          # Схеми, inputs, views/responses, types
apps/api/src/modules/reviews/            # Controller, service, module, DTO
apps/api/test/reviews.e2e-spec.ts         # Права, модерація, рейтинг, гонки
```

Це заплановані нові директорії та тест, а не наявна реалізація.

## 2. Наступна черга

Cart → атомарне резервування залишків → Orders / checkout → Payments →
Search / filters. Production-задачі виконати до публічного запуску за
[окремим розділом roadmap](./api-plan.md#5-перед-публічним-production-запуском).

## Перевірка змін

- Після зміни contracts: `pnpm --filter @repo/contracts build`.
- Для API: `pnpm --filter api check-types`, `pnpm --filter api lint`,
  релевантні e2e та `pnpm --filter api build`.
- E2E виконувати з окремою `TEST_DATABASE_URL` за
  [інструкцією тестового середовища](../apps/api/test/test-register.md).
- Для Reviews зі зміною Prisma schema —
  [міграція та генерація клієнта](./db-migration-flow.md).
