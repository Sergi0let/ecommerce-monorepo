# CLAUDE.md

Конвенції цього репозиторію описані в єдиному джерелі — читай його першим:

@AGENTS.md

Деталі по темах — у `docs/*.md` (карта в кінці `AGENTS.md`).

Skills для типових задач лежать у `.claude/skills/` і завантажуються on-demand:

- `contracts-schemas` — додавання/зміна Zod-схем у `@repo/contracts`
- `nestjs-endpoints` — новий NestJS-модуль/endpoint + DTO + Swagger
- `domain-model-rules` — інваріанти Product/Variant/Price/Inventory
- `db-migrations` — потік Prisma-міграцій
- `commit-style` — формат комітів
