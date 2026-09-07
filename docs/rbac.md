# RBAC і приватні дані каталогу

## Організація

```text
apps/api/src/modules/auth/
├── decorators/require-roles.decorator.ts  # guards + roles + Swagger
├── decorators/roles.decorator.ts          # metadata ролей
├── guards/jwt.guard.ts                    # Passport access-token strategy
├── guards/roles.guard.ts                  # перевірка дозволених ролей
└── strategies/jwt.strategy.ts             # підпис JWT + актуальний користувач

apps/api/src/common/prisma/product-catalog.include.ts  # публічні поля ціни
packages/contracts/src/product/schemas/price.schema.ts # публічна ціна
packages/contracts/src/product-price/                  # внутрішня ціна з costCents
apps/api/test/rbac.e2e-spec.ts                           # HTTP + PostgreSQL
```

## Захист endpoint'ів

```ts
@RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
```

Декоратор послідовно запускає `JwtGuard` і `RolesGuard`, встановлює metadata
ролей та додає Swagger bearer/cookie security і відповіді `401`/`403`.
Принаймні одна роль обов'язкова на рівні TypeScript.

Для змішаних controllers декоратор ставиться на окремі методи. Для суто
внутрішніх `InventoryController`, `ProductPriceController` і
`WarehouseController` — на клас: нові методи автоматично успадковують захист.
`RolesGuard` надає пріоритет ролям методу перед ролями класу.

`@Roles()` задає тільки metadata, а `@ApiBearerAuth()` — тільки документацію;
самі по собі ці декоратори доступ не обмежують.

## Політика

- `ADMIN` і `MANAGER`: зміни каталогу, доступ до складів, залишків,
  внутрішніх цін та профілю користувача за ID.
- Лише `ADMIN`: видалення продукту та список усіх користувачів.
- Авторизований активний користувач будь-якої ролі: власний профіль і зміна
  пароля через self-service endpoints.
- Публічний каталог залишається доступним без авторизації.

Без дійсного access token запит повертає `401`. Коли користувач активний,
але його поточна роль не дозволена, повертається `403`.

## Актуальність прав

Після перевірки підпису та строку JWT strategy читає `id`, `email`, `role`
та `isActive` користувача з БД. `request.user` отримує актуальні поля,
а не стару роль із JWT. Деактивований або видалений користувач отримує `401`;
зміна ролі враховується на наступному захищеному запиті.

Це один додатковий запит за primary key на JWT-запит. Кешу ролей немає:
TTL-кеш без інвалідації затримав би відкликання прав. За потреби масштабування
спочатку вимірюємо навантаження; кеш можливий лише з узгодженою інвалідацією.
Зміна ролі під час уже розпочатого запиту не скасовує виконану guard-перевірку.

Це не механізм відкликання окремого access token при logout. Для такого
сценарію потрібна окрема перевірка сесії або версії токенів.

## Ціни та залишки

Внутрішні `/product-prices` повертають `ProductPriceSchema`, включно з
`costCents`. Каталог використовує `PriceSchema` без собівартості та явний
Prisma `select` публічних полів. Фільтр активної ціни й `take: 1` збережені.
Спільний include використовується для продуктів і listing'ів бренду/категорії,
тому собівартість не виходить через вкладені `variants[].prices[]`.

Повні записи Inventory доступні тільки персоналу. Публічний endpoint
доступності товару слід додавати окремо з обмеженою відповіддю; внутрішні
резерви, партії й місце зберігання публікувати не потрібно.

## Перевірки

```bash
pnpm --filter @repo/contracts build
pnpm --filter api check-types
pnpm --filter api exec tsc --noEmit -p test/tsconfig.json
pnpm --filter api lint
pnpm --filter api test:e2e
```

Для e2e потрібен `TEST_DATABASE_URL` окремої тестової PostgreSQL з
застосованими міграціями. Тести змінюють дані; development/production БД
використовувати не можна. `test/setup-env.ts` вимагає цей URL явно.

RBAC-тести перевіряють anonymous/customer відмови на всіх адміністративних
маршрутах, доступ `ADMIN/MANAGER`, admin-only операції, bearer/cookie токени,
зміну ролі, деактивацію, видалення користувача й Swagger security.
Для всіх публічних маршрутів каталогу перевіряється raw HTTP-відповідь без
`costCents`, контракт відповіді та вибір лише активної ціни.
