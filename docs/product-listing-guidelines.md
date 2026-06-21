# Product listings by category and brand

Цей документ фіксує стандарт для endpoint'ів, які повертають списки продуктів у контексті іншої сутності: категорії або бренду.

## Базове рішення

Запити виду "продукти по категорії" і "продукти по бренду" реалізовує не `ProductModule`, а модуль власника контексту:

| Use case                   | Module           | Controller           | Service method                                                                              |
| -------------------------- | ---------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| Products by category       | `CategoryModule` | `CategoryController` | `CategoryService.getProductsBySlug(...)`                                                    |
| Products by brand          | `BrandModule`    | `BrandController`    | `BrandService.getProductsBySlug(...)` або `BrandService.getProductsById(...)`               |
| Generic products CRUD/list | `ProductModule`  | `ProductController`  | `ProductService.findAll(...)`, `findById(...)`, `create(...)`, `update(...)`, `delete(...)` |

Причина: `ProductModule` відповідає за сам продукт як сутність, а `CategoryModule` і `BrandModule` відповідають за сторінки/контексти, де продукти показуються через відношення до категорії або бренду.

## Routing standard

Основний публічний lookup для storefront має бути через `slug`, бо це стабільно для URL і SEO.

```txt
GET /categories/slug/:slug/products?page=1&limit=10
GET /brands/slug/:slug/products?page=1&limit=10
```

Адмінські або внутрішні endpoint'и можуть використовувати `id`:

```txt
GET /brands/:id/products?page=1&limit=10
GET /categories/:id/products?page=1&limit=10
```

Якщо є і `slug`, і `id` варіант, назва методу має явно показувати lookup:

```ts
getProductsBySlug(slug: string, page?: number, limit?: number)
getProductsById(id: string, page?: number, limit?: number)
```

Не створюємо маршрути такого типу в `ProductController`:

```txt
GET /products/category/:slug/products
GET /products/brand/:slug/products
```

Такі маршрути змішують відповідальність продукту з навігаційним контекстом категорії або бренду.

## Service ownership

### CategoryService

`CategoryService` відповідає за:

- перевірку існування категорії;
- вибір продуктів, прив'язаних до категорії;
- застосування правил категорійного списку: `isActive`, pagination, sorting, variant prices, images;
- повернення DTO/contract shape, який описує сторінку продуктів категорії.

Очікуваний метод:

```ts
getProductsBySlug(
  slug: string,
  page: number = 1,
  limit: number = 10,
): Promise<CategoryProductsPageType>
```

### BrandService

`BrandService` відповідає за:

- перевірку існування бренду;
- вибір продуктів, прив'язаних до бренду;
- застосування правил брендового списку: `isActive`, pagination, sorting, variant prices, images;
- повернення DTO/contract shape, який описує сторінку продуктів бренду.

Очікувані методи:

```ts
getProductsBySlug(
  slug: string,
  page: number = 1,
  limit: number = 10,
): Promise<BrandProductsPageType>

getProductsById(
  id: string,
  page: number = 1,
  limit: number = 10,
): Promise<BrandProductsPageType>
```

### ProductService

`ProductService` не має знати про URL-структуру категорій або брендів.

У `ProductService` залишаємо:

- CRUD продукту;
- generic product listing, якщо потрібен `/products`;
- product detail lookup: `findById`, потенційно `findBySlug`;
- валідації цілісності продукту: brand exists, category belongs to brand, slug availability.

## DTO and contracts standard

API DTO створюються в модулі endpoint'а, але Zod-схема живе в `@repo/contracts`.

```txt
apps/api/src/modules/category/dto/category-products-page.dto.ts
apps/api/src/modules/brand/dto/brand-products-page.dto.ts
```

DTO є тонкою NestJS-обгорткою:

```ts
export class CategoryProductsPageDto extends createZodDto(
  CategoryProductsResponseSchema,
) {}

export class BrandProductsPageDto extends createZodDto(
  BrandProductsResponseSchema,
) {}
```

Якщо shape відповіді однаковий для brand/category, все одно варто мати окремі response-схеми або alias у contracts, щоб назва відповідала endpoint'у:

```txt
packages/contracts/src/product/responses/category-products.response.ts
packages/contracts/src/product/responses/brand-products.response.ts
```

Уникаємо ситуації, де `CategoryProductsPageDto` напряму використовує `BrandProductsResponseSchema`. Це працює технічно, але плутає доменну мову.

## Naming conventions

| Artifact                  | Pattern                                      | Example                                 |
| ------------------------- | -------------------------------------------- | --------------------------------------- |
| Controller method by slug | `findProductsBySlug` або `getProductsBySlug` | `CategoryController.findProductsBySlug` |
| Service method by slug    | `getProductsBySlug`                          | `CategoryService.getProductsBySlug`     |
| Service method by id      | `getProductsById`                            | `BrandService.getProductsById`          |
| API DTO                   | `<Context>ProductsPageDto`                   | `CategoryProductsPageDto`               |
| Contract response schema  | `<Context>ProductsResponseSchema`            | `CategoryProductsResponseSchema`        |
| Contract response type    | `<Context>ProductsPageType`                  | `CategoryProductsPageType`              |
| Response file             | `<context>-products.response.ts`             | `category-products.response.ts`         |

`Page` використовуємо для TypeScript type / DTO, бо відповідь містить pagination metadata.
`ResponseSchema` використовуємо для Zod-схеми, бо вона описує HTTP response shape.

## Query standard

Для pagination використовуємо спільний DTO:

```ts
@Query() query: PaginationDto
```

Сервіс нормалізує значення:

```ts
const safePage = Math.max(page, 1);
const safeLimit = Math.min(Math.max(limit, 1), 100);
const skip = (safePage - 1) * safeLimit;
```

Стандартна відповідь:

```ts
{
  data: ProductListItemType[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## Data selection standard

Для product listing повертаємо list item, а не повний product detail.

Мінімальний стандарт:

- тільки активні продукти: `isActive: true`;
- default-варіант повертається першим;
- кожен варіант містить одну активну ціну з `take: 1`;
- `product.images` містить спільні картинки, а `variant.images` — специфічні;
- зображення відсортовані за `isPrimary` і `sortOrder`;
- стабільне сортування продуктів, наприклад `orderBy: { name: 'asc' }`;
- дати серіалізовані в ISO string, якщо contract очікує JSON string.

Спільний Prisma include зберігається в
`apps/api/src/common/prisma/product-catalog.include.ts`, щоб product, brand і
category endpoint'и повертали однаковий contract shape.

## Swagger standard

Кожен endpoint повинен мати:

```ts
@ApiOperation({ summary: 'Get active products by category slug' })
@ApiResponse({ status: 200, type: CategoryProductsPageDto })
@ApiResponse({ status: 404, description: 'Category not found' })
```

Для brand:

```ts
@ApiOperation({ summary: 'Get active products by brand slug' })
@ApiResponse({ status: 200, type: BrandProductsPageDto })
@ApiResponse({ status: 404, description: 'Brand not found' })
```

Назви в Swagger мають відповідати реальному route param. Якщо route має `:slug`, то `@Param('slug')`, не `@Param('id')`.

## Checklist for a new listing endpoint

1. Вибрати owner module: `category` або `brand`.
2. Додати route в owner controller.
3. Додати method в owner service.
4. Додати або перевикористати response schema в `@repo/contracts`.
5. Створити API DTO в `apps/api/src/modules/<owner>/dto`.
6. Підключити `PaginationDto`.
7. Додати Swagger metadata.
8. Перевірити, що `ProductController` не містить context-specific routes.
9. Перевірити неймінг: `CategoryProducts...` для category, `BrandProducts...` для brand.

## Current cleanup notes

Поточний `CategoryController` вже відповідає цьому підходу:

```txt
GET /categories/slug/:slug/products
```

Поточний `BrandController` має id-based endpoint:

```txt
GET /brands/:id/products
```

Якщо потрібен storefront URL по slug, додаємо окремо:

```txt
GET /brands/slug/:slug/products
```

Поточну заготовку в `ProductController` для category products потрібно прибрати або перенести в `CategoryController`, бо вона порушує ownership і має mismatch між `:slug` та `@Param('id')`.
