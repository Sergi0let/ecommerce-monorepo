---
name: contracts-schemas
description: Add or change Zod schemas and TS types in the @repo/contracts package. Use when creating/editing schemas, inputs, views, responses, or types for a domain (product, brand, category, users, ...), or wiring DTOs from contracts.
---

# Contracts — шари схем

**Читай першим:** `docs/contracts-domain-system.md`

## Коли застосовувати

Будь-яка робота зі схемами/типами в `packages/contracts/src/<domain>/`.

## Ланцюг шарів

`schemas/` (сутність з БД) → `inputs/` (тіло запиту) → `views/` (контекстні
композиції) → `responses/` (shape HTTP-відповіді) → `types/` (`z.infer`/`z.input`).

## Мушу памʼятати

- Валідація живе **тільки** в `@repo/contracts` — не дублюй у `apps/api`.
- Між доменами імпортуй через `index.js`, не deep-path.
- Дати в JSON — `z.iso.datetime()`, не `z.date()`.
- Nullable з БД — `.nullable()` на response-полях.
- `inputs/` не копіюють повну entity: без `id`, `createdAt`, `productId` тощо.
- API DTO — тонка обгортка: `class XDto extends createZodDto(XSchema) {}`.
- Новий домен → додати export у `src/index.ts` **і** в `package.json` → `exports`.
- Іменування: `PascalCase` + `Schema` / `Type` / `InputType`; файл `<name>.response.ts`.

## Перевірка

```bash
pnpm --filter @repo/contracts build
pnpm --filter api check-types
```
