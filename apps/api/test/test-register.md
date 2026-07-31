Домовились. Розберімо тести не як магічний код, а як звичайний сценарій взаємодії користувача з API.

## Що ми тестуємо

Наш integration-тест перевіряє весь ланцюжок:

```text
HTTP-запит
  → AuthController
  → AuthService
  → UsersService
  → PostgreSQL test database
  → HTTP-відповідь і cookies
```

Це не unit-тест одного методу. Ми запускаємо майже справжній NestJS-застосунок і надсилаємо йому HTTP-запити.

## Імпорти

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@repo/database';
```

- `INestApplication` — тип запущеного Nest-застосунку.
- `Test` — інструмент NestJS для створення застосунку в тестах.
- `prisma` — доступ до тестової PostgreSQL бази.

```ts
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
```

Це функції Jest:

- `describe` — групує тести;
- `it` — оголошує один тестовий сценарій;
- `expect` — перевіряє результат;
- `beforeAll` — виконується один раз перед усіма тестами;
- `beforeEach` — виконується перед кожним тестом;
- `afterAll` — виконується після всіх тестів.

```ts
import request from 'supertest';
```

`supertest` дозволяє робити HTTP-запити до Nest-застосунку без запуску окремого сервера на порту `3006`.

## Верхній `describe`

```ts
describe('Auth integration', () => {
  // тести
});
```

Це просто група тестів з назвою `Auth integration`.

Вивід Jest через це має зрозумілу структуру:

```text
Auth integration
  POST /api/auth/register
    ✓ registers a user
    ✓ returns 409
```

`describe` нічого самостійно не тестує.

## Тестові дані

```ts
const userInput = {
  email: 'alice@example.com',
  password: 'Password1',
  firstName: 'Alice',
  lastName: 'Tester',
};
```

Це тіло запиту, яке умовний frontend відправить під час реєстрації:

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "email": "alice@example.com",
  "password": "Password1",
  "firstName": "Alice",
  "lastName": "Tester"
}
```

Ми винесли дані в окрему змінну, тому не дублюємо їх у кожному тесті.

## Очищення бази

```ts
const cleanAuthData = async () => {
  await prisma.refreshSession.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.user.deleteMany();
};
```

Тести не повинні залежати один від одного.

Наприклад, якщо Alice залишиться в базі після першого тесту, наступний тест може отримати `409`, хоча очікував успішну реєстрацію.

Спочатку видаляємо сесії й social accounts, а потім користувачів, тому що вони пов’язані зовнішніми ключами:

```text
User
├── RefreshSession
└── SocialAccount
```

## Запуск NestJS перед тестами

```ts
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.init();
});
```

Розберімо по рядках.

```ts
Test.createTestingModule({
  imports: [AppModule],
})
```

Створює тестовий Nest-модуль. Ми імпортуємо справжній `AppModule`, тому отримуємо справжні:

- controllers;
- services;
- guards;
- Prisma;
- validation pipes;
- AuthModule і UsersModule.

```ts
.compile();
```

Nest аналізує модулі та створює всі залежності через dependency injection.

```ts
app = moduleRef.createNestApplication();
```

Створює Nest-застосунок, але ще не запускає його.

```ts
app.use(cookieParser());
```

Додає обробку cookies. Це важливо для refresh і logout.

```ts
app.setGlobalPrefix('api');
```

Тому маршрут має адресу:

```text
/api/auth/register
```

а не:

```text
/auth/register
```

```ts
await app.init();
```

Ініціалізує застосунок. Окремий TCP-порт тут не відкривається.

## Перед кожним тестом

```ts
beforeEach(async () => {
  await cleanAuthData();
});
```

Перед кожним `it(...)` база очищається.

Завдяки цьому кожен тест починається з однакового стану:

```text
users = 0
refreshSessions = 0
socialAccounts = 0
```

Це одна з найважливіших властивостей хороших тестів: один тест не впливає на інший.

## Після тестів

```ts
afterAll(async () => {
  await cleanAuthData();
  await app.close();
});
```

Після завершення:

1. Прибираємо створені записи.
2. Закриваємо Nest-застосунок.
3. Закривається підключення Prisma до БД.

Без `app.close()` Jest іноді може повідомляти:

```text
Jest did not exit after the test run
```

## Перший HTTP-запит

```ts
const response = await request(app.getHttpServer())
  .post('/api/auth/register')
  .send(userInput)
  .expect(201);
```

Читається майже як речення:

> Надішли POST-запит на `/api/auth/register` з `userInput` і очікуй статус `201`.

`app.getHttpServer()` повертає внутрішній HTTP-сервер NestJS.

```ts
.post('/api/auth/register')
```

Вибираємо HTTP method і route.

```ts
.send(userInput)
```

Надсилаємо JSON body.

```ts
.expect(201)
```

Перевіряємо статус відповіді. Якщо API поверне `400`, `409` або `500`, тест одразу впаде.

## Перевірка відповіді

```ts
expect(response.body).toMatchObject({
  user: {
    email: userInput.email,
    firstName: userInput.firstName,
    lastName: userInput.lastName,
    role: 'CUSTOMER',
    provider: 'LOCAL',
    isEmailVerified: false,
    isActive: true,
  },
});
```

`expect(...)` отримує фактичний результат.

`toMatchObject(...)` перевіряє, що відповідь містить перелічені поля.

Ми не перевіряємо всю відповідь один в один. Наприклад, `id` і `createdAt` генеруються динамічно, тому їхні конкретні значення наперед невідомі.

```ts
expect(response.body.user).not.toHaveProperty('passwordHash');
```

Перевіряємо безпеку відповіді:

> Об’єкт користувача не повинен містити хеш пароля.

Навіть хеш пароля не можна повертати frontend-у.

## Перевірка cookies

Після реєстрації сервер надсилає заголовки:

```http
Set-Cookie: access_token=...
Set-Cookie: refresh_token=...
```

Ми отримуємо їх так:

```ts
const cookies = response.headers['set-cookie'] as unknown as string[];
```

Після цього перевіряємо:

```ts
expect(cookies).toEqual(
  expect.arrayContaining([
    expect.stringMatching(/^access_token=.*HttpOnly; SameSite=Lax$/),
    expect.stringMatching(/^refresh_token=.*HttpOnly; SameSite=Lax$/),
  ]),
);
```

Тут є три matcher-и:

- `toEqual` — порівнює значення;
- `arrayContaining` — масив має містити потрібні елементи;
- `stringMatching` — рядок має відповідати регулярному виразу.

Ми перевіряємо не конкретний JWT, бо він щоразу новий, а його властивості:

- назву cookie;
- `Max-Age`;
- `Path`;
- `HttpOnly`;
- `SameSite=Lax`.

## Перевірка бази даних

HTTP-відповідь `201` ще не гарантує, що дані правильно записалися в БД. Тому читаємо користувача безпосередньо через Prisma:

```ts
const user = await prisma.user.findUniqueOrThrow({
  where: { email: userInput.email },
  include: { refreshSessions: true },
});
```

`findUniqueOrThrow`:

- поверне користувача, якщо він існує;
- кине помилку й завалить тест, якщо користувача немає.

`include` також завантажує refresh-сесії користувача.

## Перевірка пароля

```ts
expect(user.passwordHash).not.toBe(userInput.password);
```

Пароль у базі не повинен зберігатися як звичайний текст.

Потім перевіряємо, що bcrypt-хеш справді відповідає паролю:

```ts
await expect(
  bcrypt.compare(userInput.password, user.passwordHash!),
).resolves.toBe(true);
```

`bcrypt.compare(...)` повертає Promise.

Тому:

```ts
resolves.toBe(true)
```

означає:

> Очікуємо, що Promise успішно завершиться зі значенням `true`.

## Перевірка сесії

```ts
expect(user.refreshSessions).toHaveLength(1);
expect(user.refreshSessions[0]?.revokedAt).toBeNull();
```

Після реєстрації повинна бути:

- рівно одна refresh-сесія;
- сесія ще не відкликана.

```text
revokedAt = null → сесія активна
revokedAt = Date → сесія відкликана
```

## Тест повторної реєстрації

```ts
await request(app.getHttpServer())
  .post('/api/auth/register')
  .send(userInput)
  .expect(201);
```

Спочатку реєструємо Alice.

Потім надсилаємо такий самий запит:

```ts
const response = await request(app.getHttpServer())
  .post('/api/auth/register')
  .send(userInput)
  .expect(409);
```

Оскільки email вже зайнятий, очікуємо:

```http
409 Conflict
```

Перевіряємо повідомлення:

```ts
expect(response.body.message).toBe(
  'User with this email already exists',
);
```

`toBe` використовується для точного порівняння простих значень.

Наприкінці перевіряємо, що невдалий запит не створив зайвих записів:

```ts
await expect(prisma.user.count()).resolves.toBe(1);
await expect(prisma.refreshSession.count()).resolves.toBe(1);
```

Має залишитися:

```text
1 user
1 refresh session
```

а не два.

## Головна формула тесту

Майже кожен тест має три частини:

```text
Arrange → Act → Assert
```

У нашому тесті:

```ts
// Arrange — підготували userInput і чисту базу

// Act — виконали HTTP-запит
const response = await request(app.getHttpServer())
  .post('/api/auth/register')
  .send(userInput);

// Assert — перевірили результат
expect(response.status).toBe(201);
```

Українською:

```text
Підготуй → Виконай → Перевір
```

---
Для Auth ще є багато корисних сценаріїв. Я б ішов від простих до складніших.

Наступним протестуй disabled user:

```text
1. Зареєструвати користувача
2. Через Prisma встановити isActive = false
3. Спробувати login
4. Очікувати 401
5. Перевірити message = "Account is disabled"
6. Перевірити, що нова сесія не створилась
```

Каркас:

```ts
it('returns 401 for a disabled user', async () => {
  // Arrange: register

  // Arrange: prisma.user.update(... isActive: false)

  // Act: login

  // Assert: status, message, session count
});
```

Після цього рекомендований порядок:

1. Login з неіснуючим email → `401`

Важливо, щоб відповідь була такою самою, як для неправильного пароля:

```text
Invalid email or password
```

Це не дозволяє зловмиснику перевіряти, які email зареєстровані.

2. Невалідний register → `400`

Сценарії:

```text
неправильний email
пароль коротший за 8 символів
пароль без великої літери
пароль без цифри
```

Ці тести перевірять Zod validation.

3. `GET /api/users/me`

Сценарії:

```text
без access cookie → 401
з access cookie → 200 і правильний user
```

Тут зручно використати `supertest.agent()`, який запам’ятовує cookies між запитами:

```ts
const agent = request.agent(app.getHttpServer());

await agent
  .post('/api/auth/login')
  .send(credentials)
  .expect(200);

await agent
  .get('/api/users/me')
  .expect(200);
```

4. Refresh token

Основний сценарій:

```text
register
→ POST /api/auth/refresh
→ 200
→ створена нова пара cookies
→ стара RefreshSession відкликана
→ створена нова активна RefreshSession
```

5. Refresh rotation

Критичний security-сценарій:

```text
взяти перший refresh token
→ виконати refresh
→ повторно використати старий token
→ отримати 401
```

6. Logout

```text
register/login
→ logout
→ 204
→ cookies очищені
→ RefreshSession.revokedAt більше не null
```

7. Refresh після logout

```text
login
→ logout
→ спроба refresh зі старим token
→ 401
```

Найкращий наступний тест для тебе зараз:

```ts
it('returns 401 for a disabled user', async () => {});
```

Він навчить не лише робити HTTP-запити, а й готувати потрібний стан користувача через Prisma.