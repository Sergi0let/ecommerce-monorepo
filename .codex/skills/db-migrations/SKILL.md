---
name: db-migrations
description: Run the Prisma migration workflow in packages/database after changing schema.prisma. Use whenever a model or field is added/changed and the database or Prisma Client needs updating.
---

# Prisma-міграції

**Читай першим:** `docs/db-migration-flow.md`

## Коли застосовувати

Після будь-якої зміни в `packages/database/prisma/schema.prisma`.

## Потік (dev)

```bash
cd packages/database
pnpm db:migrate     # створює + застосовує міграцію, питає назву
pnpm db:generate    # регенерує Prisma Client
```

- Назва міграції — осмислена, напр. `add_user_auth_model`.
- Перевір, що зʼявився файл у `prisma/migrations/`.
- Онови сідери й запусти `pnpm db:seed`, якщо треба.

## Середовища

- `pnpm db:migrate` — локальна розробка.
- `pnpm db:deploy` — CI/prod (застосовує готові міграції, не створює нові).
- `pnpm db:reset` — лише dev, скидає БД.

Несумісні з даними зміни — Prisma попросить SQL-правки; не пропускай цей крок.
