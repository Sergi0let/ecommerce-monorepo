---
name: nestjs-endpoints
description: Add or modify a NestJS module, controller, service, or endpoint in apps/api. Use when creating CRUD/list endpoints, DTOs, guards, or Swagger docs, and when deciding which module owns a product-listing route.
---

# NestJS-модулі та endpoint'и

**Читай першим:** `docs/add-nestjs.md` та `docs/product-listing-guidelines.md`

## Коли застосовувати

Створення/зміна модулів, контролерів, сервісів, DTO у `apps/api/src/modules/`.

## Мушу памʼятати

- Модуль = controller + service + `dto/`. DTO — `createZodDto(<Schema>)` зі схеми `@repo/contracts`.
- Кожен endpoint має Swagger: `@ApiOperation` + `@ApiResponse` (статуси й `type`).
- Захищені endpoint'и: `@UseGuards(JwtGuard)` + `@ApiBearerAuth()`; user береться з `req.user`.
- **Ownership listing'у**: "продукти по бренду/категорії" — у `BrandModule`/`CategoryModule`, **не** в `ProductModule`.
- Storefront lookup по `slug`, адмін по `id`; метод показує lookup: `getProductsBySlug` / `getProductsById`.
- Pagination — спільний `PaginationDto`; нормалізуй `page`/`limit` у сервісі.
- Спільний Prisma include — `apps/api/src/common/prisma/product-catalog.include.ts`.
- Route param і Swagger мають збігатися: `:slug` → `@Param('slug')`.

## Перевірка

```bash
pnpm --filter api check-types
pnpm --filter api lint
```
