# AGENTS.md — market-cosmo

Єдине джерело правди для AI-інструментів (Codex, Cursor, Claude). Стислі
конвенції + вказівники на детальні документи в `docs/`. Читай відповідний
`docs/*.md` перед нетривіальною роботою в тій зоні.

## Стек

- **Monorepo**: Turborepo + pnpm workspaces (`apps/*`, `packages/*`).
- **apps/api**: NestJS 11, порт `3006`, глобальний префікс `/api`, Swagger на `/api/docs`.
- **apps/web**: Next.js 16, порт `3010`.
- **packages/database** (`@repo/database`): Prisma 7 + `@prisma/adapter-pg`, PostgreSQL.
- **packages/contracts** (`@repo/contracts`): Zod-схеми + TS-типи, спільні для api/web.
- **packages/ui**, **packages/eslint-config**, **packages/typescript-config**.

Локальний Postgres — через `docker-compose.yml` на порту `5466`. `DATABASE_URL` у `.env`.

## Команди

```bash
pnpm dev                          # усі apps
pnpm --filter api dev             # тільки API (3006)
pnpm --filter web dev             # тільки web (3010)

pnpm --filter api build           # збірка API (prebuild збирає database + contracts)
pnpm --filter api check-types     # tsc --noEmit
pnpm --filter api lint

pnpm --filter @repo/contracts build   # обовʼязково після зміни схем перед типчеком api
pnpm turbo run check-types            # типи по всьому monorepo
```

БД (з `packages/database`, або `pnpm --filter @repo/database <script>`):

```bash
pnpm db:migrate    # dev: створити + застосувати міграцію
pnpm db:generate   # регенерувати Prisma Client
pnpm db:deploy     # CI/prod: застосувати готові міграції
pnpm db:reset      # dev: скинути БД
```

## Робочі принципи

- Зміни точкові: чіпай лише те, що вимагає задача. Не рефактори сусідній код.
- Простота передусім: мінімум коду, без спекулятивних абстракцій.
- Наслідуй локальні патерни й іменування замість нових.
- Після зміни коду запускай релевантні перевірки (`check-types`, `lint`, `build`).
- Не додавай production-залежності без пояснення навіщо.

## Ключові конвенції (деталі — у `docs/`)

### Contracts — шари схем · `docs/contracts-domain-system.md`

Ланцюг: `schemas/` (сутність з БД) → `inputs/` (тіло запиту) → `views/`
(контекстні композиції) → `responses/` (shape HTTP-відповіді) → `types/`
(`z.infer`/`z.input`).

- Валідація живе **тільки** в `@repo/contracts`, не дублюй у `apps/api`.
- Між доменами імпортуй через `index.js`, не deep-path.
- Дати в JSON — `z.iso.datetime()`, не `z.date()`. Nullable з БД — `.nullable()`.
- API DTO — тонка обгортка: `class XDto extends createZodDto(XSchema) {}`.
- Web парсить відповідь тією ж схемою (`safeParse`).
- Іменування: `PascalCase` + `Schema` / `Type` / `InputType`; файл `<name>.response.ts`.

### NestJS-модулі та endpoint'и · `docs/add-nestjs.md`

- Кожна сутність — модуль з controller + service + `dto/` (createZodDto).
- Захищені endpoint'и — `@UseGuards(JwtGuard)` + `@ApiBearerAuth()`.
- Кожен endpoint має Swagger: `@ApiOperation`, `@ApiResponse`.

### Product listing ownership · `docs/product-listing-guidelines.md`

- "Продукти по бренду/категорії" реалізує **BrandModule / CategoryModule**, не `ProductModule`.
- Storefront lookup — по `slug`, адмін/внутрішній — по `id`; назва методу показує lookup (`getProductsBySlug` / `getProductsById`).
- Pagination через спільний `PaginationDto`; спільний include — `apps/api/src/common/prisma/product-catalog.include.ts`.

### Доменні інваріанти · `docs/product-variants.md`, `docs/product-pricing.md`, `docs/warehouse-domain.md`

- `ProductVariant` — єдина продавана сутність. `Product` — контентний агрегат.
- **Ціна належить варіанту** (`Price.variantId`), ціни рівня продукту немає.
- **Inventory** належить парі `variantId + warehouseId` (unique). Доступно = `quantity - reserved`.
- Продукт має ≥1 варіант і рівно один `isDefault`; `slug` та `sku` варіанта глобально унікальні; `productId` варіанта незмінний.
- `ProductImage.variantId = null` → спільне зображення продукту.

### БД-міграції · `docs/db-migration-flow.md`

Зміни `schema.prisma` → `cd packages/database` → `pnpm db:migrate` (дай осмислену назву, напр. `add_user_auth_model`) → `pnpm db:generate`. `db:deploy` — лише для CI/prod.

### Коміти · `docs/commits.md`

Формат `type(scope): description` (`feat`, `fix`, `docs`, `chore`, `refactor`).
Великі блоки — тематичні бренчі/PR.

## Інфраструктура · `docs/infrastructure.md`

Vercel (web) · Render/Koyeb (api) · Neon (PostgreSQL) · Cloudflare R2 (зображення).
У БД зберігати **лише URL** зображень; обробка через Sharp (WebP, resize
thumbnail/medium/large, зняти EXIF).

## Roadmap · `docs/api-plan.md`

Пріоритет: Auth → User profile → Product images → Reviews → Cart/Orders →
Inventory ops → Search → Promotions/Analytics.

## Карта `docs/`

| Файл | Про що |
|------|--------|
| `contracts-domain-system.md` | Шари Zod-схем, іменування, DTO |
| `product-listing-guidelines.md` | Ownership listing-endpoint'ів, routing, pagination |
| `product-variants.md` | Product vs Variant, інваріанти, зображення |
| `product-pricing.md` | Ціна належить варіанту, активна ціна |
| `warehouse-domain.md` | Warehouse/Inventory, доступний залишок |
| `db-migration-flow.md` | Prisma migrate/generate/deploy |
| `add-nestjs.md` | Додавання NestJS-app, типові помилки |
| `add-prisma-to-packages.md` | Prisma як `@repo/database`, gotchas |
| `commits.md` | Формат комітів і git-flow |
| `infrastructure.md` | Деплой, upload pipeline, R2/Sharp |
| `api-plan.md` | Пріоритети розвитку API, план Auth |
| `codex-vscode.md` | Робота з Codex у VS Code |
