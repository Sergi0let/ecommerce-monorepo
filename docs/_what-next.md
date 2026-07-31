# Що робити після базового Auth

Не переходити одразу до великого нового модуля. Спочатку потрібно завершити
Auth/Users security flows і зафіксувати їх тестами.

## Поточний стан

Вже готово:

- Auth e2e-набір для register, login, `/users/me`, refresh і logout;
- refresh token rotation та відкликання сесії під час logout;
- модель `PasswordResetToken` і Prisma migration;
- `POST /api/auth/request-password-reset`;
- `POST /api/auth/reset-password`;
- password reset відкликає усі активні `RefreshSession` користувача.

У процесі:

- e2e-тести password reset;
- тимчасова delivery reset URL через development log;
- справжня відправка листів буде пізніше через `MailService` і email provider.

## 1. Завершити password reset

Маршрути належать `AuthModule`, бо користувач ще не авторизований:

```text
POST /api/auth/request-password-reset
POST /api/auth/reset-password
```

### Request reset password

Запит приймає:

```json
{
  "email": "alice@example.com"
}
```

Незалежно від того, чи існує user, API завжди повертає:

```json
{
  "message": "If the account exists, a reset email has been sent"
}
```

Це не дозволяє перевіряти, які email зареєстровані в системі.

Для існуючого user:

```text
створити випадковий raw token
→ зберегти тільки SHA-256 tokenHash у PasswordResetToken
→ видалити старі невикористані reset tokens цього user
→ створити один новий token з expiresAt
→ надіслати reset URL у листі
```

Raw token не можна повертати в HTTP-відповіді, зберігати в БД або логувати в
production. Поки немає MailService, reset URL можна логувати лише в development.

### Reset password

Frontend бере token із посилання в листі:

```text
http://localhost:3010/reset-password?token=<raw-token>
```

Після введення нового пароля надсилає:

```json
{
  "token": "<raw-token>",
  "newPassword": "NewPassword1"
}
```

Backend:

```text
SHA-256(raw token)
→ знайти tokenHash у БД
→ перевірити usedAt = null і expiresAt > now
→ перевірити, що пароль відрізняється від поточного
→ оновити passwordHash
→ поставити usedAt
→ відкликати всі RefreshSession цього user
```

Оновлення пароля, використання token і відкликання сесій виконуються в одній
Prisma transaction.

### Обов'язкові e2e-тести

У `apps/api/test/auth.e2e-spec.ts` додати сценарії:

- request повертає однаковий `200` для існуючого й неіснуючого email;
- request для існуючого user створює `PasswordResetToken` із `tokenHash`,
  `usedAt: null` і майбутнім `expiresAt`;
- другий request видаляє старий token та залишає тільки новий;
- reset змінює пароль, позначає token використаним і відкликає refresh sessions;
- використаний або протермінований token повертає `400`;
- поточний пароль не можна використати як новий.

Для ручного тестування міграцій test database дивись
[`apps/api/test/test-register.md`](../apps/api/test/test-register.md).

## 2. Email verification

Після password reset реалізувати схожий flow:

```text
POST /api/auth/verify-email
```

Потрібні одноразовий token, `tokenHash`, `expiresAt`, `usedAt` і запис у БД.
Після успішної перевірки встановлювати `user.isEmailVerified = true`.

## 3. RolesGuard

У `User` уже є ролі `CUSTOMER`, `ADMIN`, `MANAGER`, але вони ще не обмежують
доступ до адміністративних операцій.

Потрібно додати `RolesGuard` і закрити ним mutation endpoint-и для продуктів,
брендів, категорій, цін, варіантів і складів.

Не додавати `GET /users` у password reset commit: список усіх користувачів —
окрема admin-функція, яка потребує role-based захисту.

## 4. Production hardening

Перед production:

- прибрати fallback JWT secrets;
- додати централізовану env validation;
- додати rate limit для register, login, refresh і password reset;
- підключити `MailService` та email provider;
- очищати прострочені refresh/reset tokens;
- перевірити CSRF-модель для web/API deployment;
- обмежити або закрити публічний `GET /users/:id`.

## 5. Product Images

Після завершення Auth foundation наступний великий модуль за roadmap:

```text
upload
→ MIME / file-size validation
→ Sharp: EXIF removal, resize, WebP
→ thumbnail / medium / large
→ Cloudflare R2
→ зберігати в PostgreSQL лише URL
```

```text
variantId = null     → спільне зображення Product
variantId != null    → зображення конкретного ProductVariant
```

## Перевірка перед комітом password reset

```bash
pnpm --filter @repo/database db:generate
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api test:e2e
pnpm --filter api build
```

Коміт після завершення e2e-тестів:

```text
feat(api): implement password reset flow
```
