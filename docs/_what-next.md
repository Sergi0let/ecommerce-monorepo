# Де продовжуємо API

Найближча робота: короткий fix Auth / Users, потім **Reviews**.
Повний залишок roadmap — у [api-plan.md](./api-plan.md).
Після завершення задачі видаляємо її звідси; історію виконаного не накопичуємо.

## 1. Наступна задача — профіль і password flows

У [UsersService](../apps/api/src/modules/users/users.service.ts) є дві конкретні
прогалини:

- `updateProfile()` змінює email без скидання `isEmailVerified` та інвалідації
  токенів. Найпростіший наступний крок — виключити email зі звичайного profile
  update й явно відхиляти його в запиті. Зміну адреси робити окремим flow пізніше.
- `changePassword()` повторно записує `passwordHash` після транзакції.
  Прибрати другий запис; пароль і відкликання refresh sessions змінювати разом.

Де працювати:

- [UpdateUserSchema](../packages/contracts/src/users/inputs/update-user.schema.ts)
  — дозволені поля профілю; реєстрацію не обмежувати разом із profile update.
- [UsersService](../apps/api/src/modules/users/users.service.ts) — обидва виправлення.
- [AuthService](../apps/api/src/modules/auth/auth.service.ts) — реалізація reset,
  яку потрібно покрити тестами.
- [auth.e2e-spec.ts](../apps/api/test/auth.e2e-spec.ts) — додати e2e для
  `reset-password`, `change-password` та `PATCH /users/me`.

Перевірити успішну зміну пароля, неправильний поточний пароль, відхилення
email у profile update, прострочений/використаний reset token, два конкурентні
reset-запити та неможливість refresh після відкликання сесій.
Перевірки request-reset не замінюють перевірки самого reset-password.

## 2. Потім — Reviews

Перший крок — розширити `Review` у
[schema.prisma](../packages/database/prisma/schema.prisma): автор, статус
модерації та унікальність пари user/product. Спочатку перевірити, чи є дані
для перенесення; наявність моделі не означає готовий Reviews API.

Далі contracts → `ReviewsModule` → власні create/update/delete →
публічний paginated listing → moderation → узгоджений рейтинг продукту.
Правила та тестові сценарії — у [roadmap](./api-plan.md#2-reviews--наступний-новий-модуль).

Робочі файли для нового модуля:

```text
packages/database/prisma/schema.prisma   # Автор і статус відгуку
packages/contracts/src/reviews/          # Схеми, inputs, views/responses, types
apps/api/src/modules/reviews/            # Controller, service, module, DTO
apps/api/test/reviews.e2e-spec.ts         # Права, модерація, рейтинг, гонки
```

Це заплановані нові директорії та тест, а не наявна реалізація.

## 3. Наступна черга

Cart → атомарне резервування залишків → Orders / checkout → Payments →
Search / filters. Production-задачі виконати до публічного запуску за
[окремим розділом roadmap](./api-plan.md#6-перед-публічним-production-запуском).

## Перевірка змін

- Після зміни contracts: `pnpm --filter @repo/contracts build`.
- Для API: `pnpm --filter api check-types`, `pnpm --filter api lint`,
  релевантні e2e та `pnpm --filter api build`.
- E2E виконувати з окремою `TEST_DATABASE_URL` за
  [інструкцією тестового середовища](../apps/api/test/test-register.md).
- Для Reviews зі зміною Prisma schema —
  [міграція та генерація клієнта](./db-migration-flow.md).
