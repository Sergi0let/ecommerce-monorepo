Наступним я б не переходив одразу до нового великого модуля. Спочатку варто довести Auth/Users до завершеного й безпечного стану.

Рекомендований порядок:

1. Додати інтеграційні тести Auth.
2. Реалізувати email verification і password reset.
3. Додати RolesGuard для адміністративних endpoint-ів.
4. Посилити production-конфігурацію.
5. Після цього перейти до Product Images.

Найкращий наступний крок прямо зараз — auth e2e tests.

## 1. Auth e2e tests

Зараз auth уже має достатньо функціональності, але автоматичних тестів практично немає. Треба покрити:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /users/me
```

Критичні сценарії:

- успішна реєстрація;
- повторний email → `409`;
- правильний login;
- неправильний пароль → `401`;
- disabled user → `401`;
- access cookie дозволяє `/users/me`;
- refresh створює нову пару токенів;
- старий refresh token після rotation більше не працює;
- logout встановлює `revokedAt`;
- refresh після logout → `401`;
- cookies мають правильні `httpOnly`, `path`, `sameSite`;
- Google callback не тестувати через реальний Google — mock strategy/profile.

Це зафіксує вже створену архітектуру перед наступними змінами.

## 2. Завершити Users security flows

Зараз ці endpoint-и фактично є заглушками:

```text
POST /users/verify-email
POST /users/request-password-reset
POST /users/reset-password
```

Особливо важлива проблема: `requestPasswordReset()` повертає `404`, якщо email не існує. Це дозволяє перевіряти, які email зареєстровані.

Правильна відповідь завжди однакова:

```json
{
  "message": "If the account exists, a reset email has been sent"
}
```

Потрібні одноразові tokens:

```text
EmailVerificationToken
PasswordResetToken
```

У БД зберігати:

- `tokenHash`;
- `userId`;
- `expiresAt`;
- `usedAt`;
- `createdAt`.

Після password reset варто відкликати всі активні refresh sessions користувача.

## 3. RolesGuard

У `User` уже є:

```text
CUSTOMER
ADMIN
MANAGER
```

Але роль із JWT поки ніде не обмежує доступ. Треба додати:

```ts
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@UseGuards(JwtGuard, RolesGuard)
```

Після цього захистити mutation endpoint-и:

- створення/редагування продуктів;
- brands/categories;
- prices;
- variants;
- warehouse/inventory;
- product images.

Важливо: `JwtGuard` лише встановлює identity. `RolesGuard` відповідає за право виконувати адміністративну дію.

## 4. Production hardening

Перед production необхідно:

- прибрати fallback `dev-access-secret-change-me`;
- прибрати fallback `dev-refresh-secret-change-me`;
- додати централізовану env validation;
- додати rate limit для register/login/refresh/reset-password;
- додати cleanup прострочених `RefreshSession`;
- після зміни пароля відкликати інші сесії;
- перевірити CSRF-модель для deployment web/API;
- додати обробку невдалого Google OAuth redirect;
- перевірити race condition під час прив’язування `SocialAccount`.

Також `GET /users/:id` зараз публічний і повертає повний `UserType`. Треба або закрити його роллю, або створити окремий обмежений public profile response.

## 5. Product Images

Після завершення auth foundation — наступний продуктовий модуль за roadmap.

Потрібно перевірити/реалізувати:

```text
upload
→ перевірка MIME і розміру
→ Sharp: EXIF removal, resize, WebP
→ thumbnail / medium / large
→ Cloudflare R2
→ збереження лише URL у PostgreSQL
→ ProductImage для product або variant
```

При цьому:

```text
variantId = null → спільне зображення Product
variantId != null → зображення конкретного ProductVariant
```

Моя конкретна рекомендація: наступною задачею зробити e2e-набір для `register → login → me → refresh → logout`. Після нього — справжній password reset. Це найкраще зміцнить API перед розширенням каталогу.


Не обов’язково тримати Google OAuth branch відкритою до завершення всього Auth.

Якщо поточна гілка присвячена саме Google OAuth і вже:

- проходить `check-types`;
- проходить lint;
- Google redirect та callback працюють;
- створюється/знаходиться користувач;
- встановлюються cookies;
- створюється `RefreshSession`;
- видалений небезпечний `POST /auth/social`;
- секрети не потрапили в commit;

то її варто закомітити й merge зараз:

```text
feat(api): add Google OAuth authentication
```
---

Наступні завдання краще виконувати окремими гілками:

```text
test/api-auth-flow
feat/email-verification
feat/password-reset
feat/role-guards
feat/product-image-upload
```



Перед merge я б лише запустив:

```bash
pnpm --filter @repo/contracts build
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api build
```

Отже: якщо Google login проходить повний callback і ти вручну перевірив cookies та запис користувача/сесії в БД — цю branch уже можна merge.