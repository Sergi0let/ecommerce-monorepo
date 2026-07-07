---
name: commit-style
description: Write commit messages and organize branches for this repo. Use when creating commits or planning how to split work into commits/PRs.
---

# Формат комітів

**Читай першим:** `docs/commits.md`

## Формат

```
type(scope): description
```

Типи: `feat`, `fix`, `docs`, `chore`, `refactor`.

Приклади:

```
feat(api): add auth module with jwt login
fix(database): fix prisma client import paths
docs(contracts): document schema layering
```

## Правила

- Лаконічні коміти для дрібних змін; тематичні бренчі/PR для великих блоків.
- Scope = зона (`api`, `web`, `database`, `contracts`, `ui`, `config`, `monorepo`).
- Коміти створюй **лише** коли користувач прямо просить.
