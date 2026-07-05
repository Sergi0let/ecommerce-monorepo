# План розвитку API для market-cosmo

## 1. Поточний стан

На даний момент в репозиторії вже є базова структура для ключових доменів API. Це означає, що ми не стартуємо з нуля, а маємо готову основу для продовження роботи.

### Уже є / має базову реалізацію
- Brand
- Category
- Product
- Product variant
- Product price
- Inventory
- Ingredient
- Warehouse

### Ще не охоплено або потребує розширення
- Auth / users / roles
- Reviews
- Product images / media
- Upsell / cross-sell recommendations
- Shipping class / delivery logic
- Orders / cart / checkout
- Payments / discounts / promotions
- Search / filters / recommendations

---

## 2. Пріоритетний план розвитку

Нижче список не просто по порядку, а по двом критеріям:
- важливість для продукту;
- реальність імплементації в поточному проекті.

### P0 — критично важливо і висока реалізуемість

1. Auth module
- Важливість: дуже висока
- Реалізуемість: висока
- Чому перше: без auth не можна нормально робити користувацькі сценарії, замовлення, збереження вподобань, профілі тощо.
- Що треба зробити: users, login/register, JWT, refresh token, guards, roles, social auth.

2. Product images / media
- Важливість: висока
- Реалізуемість: висока
- Чому важливо: каталоги продуктів без зображень сильно слабші.
- Що треба зробити: upload, storage, CRUD, прив’язка до product/variant.

3. Reviews
- Важливість: висока
- Реалізуемість: висока
- Чому важливо: довіра до продуктів і соціальний доказ.
- Що треба зробити: CRUD review, рейтинг, moderation, прив’язка до user/product.

### P1 — дуже важливо, але трохи складніше

4. Inventory / warehouse flow
- Важливість: висока
- Реалізуемість: середня
- Чому важливо: це вже не просто каталог, а операційна частина магазину.
- Що треба зробити: movement logs, stock updates, reservations, low-stock alerts.

5. Upsell / cross-sell recommendations
- Важливість: висока
- Реалізуемість: середня
- Чому важливо: це прямий інструмент підвищення середнього чека.
- Що треба зробити: зв’язки між продуктами, рекомендації “покращити”, “додати до купівлі”, правила правил для рекомендацій.

6. Shipping class / delivery logic
- Важливість: висока
- Реалізуемість: середня
- Чому важливо: без цього складно нормально працювати з доставкою, тарифами та логістикою.
- Що треба зробити: shipping classes, правила доставки, тарифи, залежність від ваги/розміру/країни/типу товару.

7. Orders / cart / checkout
- Важливість: висока
- Реалізуемість: середня
- Чому важливо: це core commerce сценарій.
- Що треба зробити: cart, order creation, statuses, payments integration.

8. Search / filters / catalog UX
- Важливість: висока
- Реалізуемість: середня
- Чому важливо: для магазину критично, щоб користувач швидко знаходив продукти.
- Що треба зробити: search, faceted filters, sorting, pagination, full-text або Atlas Search в майбутньому.

### P2 — важливо для росту продукту

9. Discounts / promotions / coupons
- Важливість: середня
- Реалізуемість: середня
- Що треба зробити: promo rules, coupon codes, eligibility.

10. Notifications / email / SMS
- Важливість: середня
- Реалізуемість: середня
- Що треба зробити: welcome email, order updates, password reset, otp.

11. Analytics / reporting
- Важливість: середня
- Реалізуемість: середня
- Що треба зробити: sales dashboard, product performance, stock reports.

---

## 3. Порядок модулів з урахуванням залежностей

### Фаза A — foundation
1. Auth
2. Users / profiles / roles
3. Product images
4. Reviews

### Фаза B — commerce core
5. Cart / orders
6. Payments
7. Inventory / warehouse operations

### Фаза C — growth
8. Search / filters
9. Promotions / coupons
10. Analytics / notifications

---

## 4. Що вже зроблено в проекті

### База API
- є модулі для основних сутностей;
- є Prisma schema для продуктів, інгредієнтів, складів, варіантів;
- є контрактна частина для DTO / schemas;
- є структура NestJS modules, services, controllers.

### Що вже можна вважати готовим для продовження
- CRUD для базових каталогів;
- модель даних для продуктів і пов’язаних сутностей;
- підготовка до розширення на commerce сценарії.

### Що ще треба довести до “готового продуктового стану”
- нормалізація поведінки всіх CRUD;
- уніфікація помилок і статусів;
- додавання авторизації та захисту endpoint-ів;
- додавання перевірок бізнес-логіки.

---

## 5. Рекомендації по Auth module

Я б рекомендував зробити auth на базі NestJS + Passport, а не вручну писати власну авторизацію.

### Ролі для адмінки

Ролі варто впроваджувати одразу після базового auth, але не в самій першій версії MVP. Ідея така:
- на початку зробити просту модель: user + role;
- дати мінімум 2 ролі: admin і customer;
- у майбутньому розширити до manager, support, moderator.

#### Найкращий підхід
- role — це не “велика система прав”, а базовий рівень доступу;
- для адмінки достатньо мати:
  - admin — повний доступ до адмін-панелі;
  - customer — звичайний користувач;
- права для конкретних дій (наприклад, CRUD для продуктів) краще захищати через guards, а не розмазувати по всьому коду.

#### На якому етапі впроваджувати
- Етап 1: після login/register + JWT;
- Етап 2: додати role в User model;
- Етап 3: створити AdminGuard / RolesGuard;
- Етап 4: захистити адмінські endpoint-и.

#### Практична рекомендація
Якщо хочеш не ускладнювати MVP, то роби так:
1. MVP auth: register/login/me/refresh/logout;
2. Потім roles: admin/customer;
3. Потім admin dashboard endpoints;
4. Лише далі — складніші permission systems.

Це дає хороший баланс між швидкістю впровадження і безпекою.

### Технологічний стек
- @nestjs/passport
- passport
- @nestjs/jwt
- passport-jwt
- passport-local
- passport-google-oauth20
- passport-facebook
- bcrypt
- prisma

### Архітектура

#### 1. User model
Потрібна окрема сутність User з полями:
- id
- email
- passwordHash
- firstName
- lastName
- avatarUrl
- isEmailVerified
- provider = local | google | facebook
- providerId
- role = user | admin
- createdAt / updatedAt

#### 2. Social accounts
Для чистоти моделі краще мати окрему таблицю SocialAccount:
- userId
- provider
- providerId
- email
- accessToken / refreshToken (за потреби)

Це дозволить підтримувати кілька провайдерів без сплутування акаунтів.

#### 3. Auth flow
- Email/password register/login
- Google OAuth login
- Facebook OAuth login
- JWT access token
- Refresh token
- Logout / revoke refresh token

#### 4. Security
- bcrypt для password hashing
- JWT guards для захисту endpoint-ів
- refresh token rotation
- rate limiting для login/register
- email verification для реєстрації

---

## 6. План впровадження Auth

### Етап 1 — база авторизації
1. Додати User model в Prisma.
2. Додати Auth module, Auth controller, Auth service.
3. Реалізувати register/login через email + password.
4. Додати JWT access token.

### Етап 2 — Passport strategies
5. Додати LocalStrategy для email/password.
6. Додати JwtStrategy для доступу до захищених endpoint-ів.
7. Додати RefreshToken strategy.

### Етап 3 — соціальні провайдери
8. Додати Google OAuth strategy.
9. Додати Facebook OAuth strategy.
10. Реалізувати flow: redirect → callback → create/find user → issue JWT.

### Етап 4 — продуктова інтеграція
11. Захистити API endpoints для профілю, замовлень, улюблених товарів.
12. Додати role-based access control для admin.
13. Додати middleware / guards для protected routes.

### Етап 5 — quality / production
14. Додати unit/e2e тести для auth.
15. Додати Swagger docs для auth endpoints.
16. Додати env variables для Google/Facebook secrets.

---

## 7. Практичні рекомендації

- Починати з local auth, а вже потім додавати соціальні провайдери.
- Спочатку зробити простий, але надійний JWT flow, а не одразу складати багато feature-ів.
- Для Google/Facebook краще спочатку реалізувати “login via provider” в мінімальній версії без складної профільної логіки.
- Не змішувати email/password і social accounts в одну таблицю без нормалізації.
- Для MVP достатньо: register, login, me, refresh, logout.

---

## 8. Рекомендований порядок дій

1. Auth module
2. User profile
3. Product images
4. Reviews
5. Cart / orders
6. Inventory / warehouse improvements
7. Search & filters
8. Promotions / analytics

Якщо хочеш, я можу наступним кроком одразу підготувати для тебе не просто текстовий план, а готовий tech plan для Auth module з конкретними файлами, DTO, Prisma моделями і структуру Nest модулів.
