# @repo/contracts — доменна система схем

Пакет `@repo/contracts` — єдине джерело правди для **Zod-схем** і **TypeScript-типів**, які спільно використовують `apps/api`, `apps/web` і майбутні клієнти.

Одна схема описує і валідацію, і тип (`z.infer`). Зміни в контракті автоматично відображаються в NestJS DTO (`createZodDto`) і в парсингу відповідей на фронті.

## Навіщо це

| Проблема без contracts                    | Рішення                                       |
| ----------------------------------------- | --------------------------------------------- |
| Дублювання правил у class-validator і Zod | Одна схема в `contracts`                      |
| API і web розходяться в типах             | Спільний пакет у monorepo                     |
| Незрозуміло, де живе «форма відповіді»    | Чіткі шари: `schemas` → `views` → `responses` |

## Структура пакета

```
packages/contracts/src/
├── common/                 # спільні примітиви та утиліти
│   ├── primitives.ts       # UuidSchema, SlugSchema, TimestampSchema
│   ├── pagination.ts       # PaginationQuerySchema, createPaginatedResponseSchema
│   └── parse.ts            # parseSchema, safeParseSchema
│
├── category/               # домен «категорія»
├── brand/                  # домен «бренд»
└── product/                # домен «продукт»
```

Кожен **домен** повторює однаковий шаблон папок:

```
domain/
├── schemas/     # сутність з БД (атомарні поля + вкладені entities)
├── inputs/      # тіло запиту: create, update
├── views/       # композиції під конкретний екран / фрагмент API
├── responses/   # повна shape HTTP-відповіді для endpoint
├── types/       # z.infer / z.input типи, зібрані в одному місці
└── index.ts     # публічний API домену
```

#### example on brands

```
brand/
├── inputs/
│   ├── create-brand.schema.ts
│   ├── update-brand.schema.ts
│   └── index.ts
│
├── schemas/
│   ├── brand.schema.ts
│   ├── brand-summary.schema.ts
│   ├── brand-with-counts.schema.ts
│   └── index.ts
│
├── responses/
│   ├── brand-detail.response.ts
│   ├── brand-by-slug.response.ts
│   └── index.ts
│
├── types/
│   ├── brand.types.ts
│   └── index.ts
│
└── index.ts
```

### Призначення шарів

| Шар          | Що описує                                    | Приклад                                                                 |
| ------------ | -------------------------------------------- | ----------------------------------------------------------------------- |
| `schemas/`   | Сутність як у Prisma, без контексту endpoint | `BrandSchema`, `ProductCoreSchema`, `CategorySchema`                    |
| `inputs/`    | Вхідні дані (POST/PUT body)                  | `CreateBrandSchema`, `UpdateBrandSchema`                                |
| `views/`     | «Як виглядає сутність у певному контексті»   | `ProductVariantDetailsSchema`, `ProductListItemSchema`                  |
| `responses/` | Те, що реально повертає endpoint             | `BrandDetailSchema`, `BrandBySlugSchema`, `BrandProductsResponseSchema` |
| `types/`     | TS-типи зі схем                              | `BrandType`, `ProductListItemType`                                      |

### Ланцюжок композиції (product)

```
ProductCoreSchema
  └── ProductListItemSchema        (+ shared images, variants)
        └── ProductVariantDetailsSchema (+ prices, variant images)
              └── BrandProductsResponseSchema (+ page, total, …)
```

## Поточні домени

### `brand/`

| Схема                                     | Де використовується      |
| ----------------------------------------- | ------------------------ |
| `CreateBrandSchema` / `UpdateBrandSchema` | POST/PUT `/brands`       |
| `BrandSchema`                             | базова відповідь бренду  |
| `BrandWithCountsSchema`                   | GET `/brands`            |
| `BrandSummarySchema`                      | GET `/brands/list`       |
| `BrandDetailSchema`                       | GET `/brands/:id`        |
| `BrandBySlugSchema`                       | GET `/brands/slug/:slug` |

### `product/`

| Схема                                                    | Де використовується                         |
| -------------------------------------------------------- | ------------------------------------------- |
| `ProductCoreSchema`, `PriceSchema`, `ProductImageSchema` | атоми                                       |
| `ProductVariantDetailsSchema`                            | варіант з активною ціною та власними images |
| `ProductListItemSchema`                                  | продукт зі спільними images та варіантами   |
| `BrandProductsResponseSchema`                            | GET `/brands/:id/products`                  |

### `category/`

Поки мінімальний домен: `CategorySchema` + типи. Розширювати за тим самим шаблоном (`inputs/`, `responses/`), коли з'являться CRUD-endpoint'и.

## Правила

1. **Схеми живуть тільки в `contracts`** — не дублювати валідацію в `apps/api`.
2. **Між доменами імпортувати через `index.ts`**, не deep path:
   ```ts
   // ✅
   import { CategorySchema } from "../../category/index.js";
   // ❌
   import { CategorySchema } from "../../category/schemas/category.schema.js";
   ```
3. **Response-схема = те, що повертає service** (включно з `include` / `select` Prisma).
4. **Дати в JSON** — `z.iso.datetime()`, не `z.date()` (OpenAPI / JSON Schema).
5. **Nullable з БД** — `.nullable()` на response-полях (`logo`, `websiteUrl`, …).
6. **API DTO** — тонка обгортка:
   ```ts
   export class CreateBrandDto extends createZodDto(CreateBrandSchema) {}
   ```
7. **Web** — парсинг відповіді тією ж схемою:
   ```ts
   BrandSummarySchema.array().safeParse(data);
   ```

## Імпорт у apps

```ts
// усе з домену
import { BrandBySlugSchema, type BrandSummaryType } from "@repo/contracts";

// subpath (опційно)
import { safeParseSchema } from "@repo/contracts/common";
import { ProductListItemSchema } from "@repo/contracts/product";
```

## Додавання нового домену

1. Створити `packages/contracts/src/<domain>/` з `schemas/`, `types/`, `index.ts`.
2. Додати `inputs/`, `views/`, `responses/` за потреби endpoint'ів.
3. Експортувати з `src/index.ts` і `package.json` → `exports`.
4. У `apps/api` — `createZodDto` + `@ApiResponse({ type: … })`.
5. У `apps/web` — `safeParseSchema` для відповідей fetch.

## Іменування

| Артефакт      | Конвенція                  | Приклад                    |
| ------------- | -------------------------- | -------------------------- |
| Zod-схема     | `PascalCase` + `Schema`    | `BrandDetailSchema`        |
| TS-тип        | `PascalCase` + `Type`      | `BrandDetailType`          |
| Input-тип     | `…InputType` для `z.input` | `CreateBrandInputType`     |
| Response-файл | `<name>.response.ts`       | `brand-detail.response.ts` |
