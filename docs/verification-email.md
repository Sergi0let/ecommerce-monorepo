# Email verification — план реалізації

## Мета

Користувач із локальним акаунтом підтверджує, що володіє своєю email-адресою.
Після успішного підтвердження `User.isEmailVerified` стає `true`.

Email verification не змінює email і не є перевіркою того, чи адреса зайнята:
email уже належить користувачу, для якого створюється токен. Перевірка
унікальності email залишається відповідальністю реєстрації та зміни email
(якщо такий flow буде додано окремо).

## API-контракт

Потрібні два різні endpoint-и, оскільки вони мають різне призначення.

### 1. Надіслати або повторно надіслати лист

```text
POST /api/auth/email-verification/resend
Authorization: Bearer <access token>
```

- Endpoint захищений `JwtGuard`.
- `userId` береться з JWT (`req.user.id`), а email — із користувача в БД.
- Body не потрібен, тому клієнт не може запитати верифікаційний лист для
  довільної чужої адреси.
- Якщо користувач уже підтверджений, повернути `204 No Content` без створення
  токена та відправлення листа.
- Якщо користувач не підтверджений, відкликати старі токени, створити новий і
  повернути `204 No Content`.

> Альтернатива для UX без авторизації: публічний endpoint із `{ email }`.
> Він має завжди відповідати однаково, наприклад `204`, незалежно від того,
> чи існує акаунт. Це запобігає перебору зареєстрованих email. Першою
> реалізуємо JWT-варіант, бо він простіший і безпечніший.

### 2. Підтвердити email за токеном

```text
POST /api/auth/email-verification/verify
Content-Type: application/json

{ "token": "raw-token-from-email" }
```

- Endpoint публічний: у користувача може не бути активної сесії в браузері,
  де він відкрив лист.
- Валідний токен повертає `204 No Content`.
- Невалідний, прострочений або вже використаний токен повертає `400 Bad Request`.

Поточний placeholder `POST /api/users/verify-email` слід прибрати, щоб не
лишати endpoint, який може підтвердити email без перевірки токена.

## База даних

Додати модель, аналогічну `PasswordResetToken`:

```prisma
model EmailVerificationToken {
  id        String   @id @default(uuid())
  userId    Int
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

І додати зв'язок у `User`:

```prisma
emailVerificationTokens EmailVerificationToken[]
```

Після зміни `schema.prisma`:

1. Створити й застосувати dev-міграцію з назвою `add_email_verification_token`.
2. Запустити `pnpm db:generate`.
3. Додати migration-файл до репозиторію.

## Створення токена і листа

У `AuthService`:

1. Отримати користувача за `userId` із JWT.
2. Якщо `isEmailVerified === true`, завершити запит без дії.
3. Згенерувати криптографічно випадковий одноразовий token (мінімум 32 байти).
4. Обчислити `tokenHash` (наприклад, SHA-256) і зберегти лише хеш.
5. В одній транзакції видалити всі попередні `EmailVerificationToken` цього
   користувача та створити новий з `expiresAt` (наприклад, через 24 години).
6. Надіслати лист на `user.email` із посиланням:

   ```text
   ${WEB_URL}/verify-email?token=<raw-token>
   ```

Сирий token не записується в БД, логи або API-відповідь. Він існує лише під
час створення посилання для листа.

## Підтвердження токена

У `AuthService.verifyEmail({ token })`:

1. Захешувати отриманий token тим самим алгоритмом.
2. Знайти `EmailVerificationToken` за `tokenHash`.
3. Відхилити запит, якщо запису немає, `usedAt` задано або
   `expiresAt <= now`.
4. У транзакції атомарно позначити токен використаним (`usedAt = now`) лише
   якщо він досі не використаний і не прострочений.
5. Якщо токен було успішно позначено використаним, оновити пов'язаного
   користувача: `isEmailVerified = true`.
6. Якщо конкурентний запит уже використав token, повернути `400`.

Атомарна умова в кроці 4 потрібна, щоб одне й те саме посилання не можна було
використати двічі паралельними запитами.

## Contracts, DTO та Swagger

1. У `@repo/contracts` додати `VerifyEmailSchema` з полем `token` і правилами
   валідації.
2. Створити тонкий `VerifyEmailDto extends createZodDto(VerifyEmailSchema)`.
3. Додати Swagger-описи до обох endpoint-ів (`@ApiOperation`, `@ApiResponse`).
4. Для resend endpoint застосувати `JwtGuard` і `@ApiBearerAuth()`.

## Послідовність виконання

1. Додати Prisma-модель, relation до `User`, migration і Prisma Client.
2. Додати Zod schema та DTO для `{ token }`.
3. Реалізувати в `AuthService` створення/відкликання токена й відправлення
   листа.
4. Реалізувати безпечне підтвердження токена в транзакції.
5. Додати обидва route-и до `AuthController` та видалити placeholder із
   `UsersController`.
6. Додати тести: успіх, прострочений token, використаний token, повторна
   відправка (старий token не працює), вже підтверджений користувач і два
   паралельні запити на підтвердження.
7. Запустити `pnpm --filter @repo/contracts build`,
   `pnpm --filter api check-types`, `pnpm --filter api lint` і релевантні
   тести.

## E2E test cases

Для e2e-тестів токен слід створювати напряму через Prisma: у БД зберігати
`sha256(rawToken)`, а в запит `verify` передавати `rawToken`. Не отримувати
токен із API-відповіді або логів.

### `POST /api/auth/email-verification/resend`

1. Неавторизований запит повертає `401 Unauthorized`.
2. Авторизований непідтверджений користувач отримує успішну відповідь; у БД
   створюється один `EmailVerificationToken` для нього з майбутнім `expiresAt`,
   порожнім `usedAt` і SHA-256 хешем довжиною 64 символи.
3. Повторний `resend` видаляє попередній невикористаний токен і створює новий.
4. Для вже підтвердженого користувача endpoint завершується успішно й не
   створює токен.

### `POST /api/auth/email-verification/verify`

1. Валідний `rawToken` повертає успішну відповідь, встановлює
   `User.isEmailVerified = true` і заповнює `usedAt` у відповідному токені.
2. Неіснуючий токен повертає `400 Bad Request`; стан користувача й токенів не
   змінюється.
3. Прострочений токен повертає `400`; `isEmailVerified` лишається `false`.
4. Уже використаний токен повертає `400`.
5. Токен, створений до повторного `resend`, повертає `400`; новий токен того ж
   користувача успішно підтверджує email.
6. Для вже підтвердженого користувача валідний, але ще не використаний токен
   повертає `400` і не повинен повторно змінювати стан користувача.
7. Два паралельні запити з тим самим валідним токеном дають рівно одну успішну
   відповідь і одну `400 Bad Request` — токен використовується лише один раз.
