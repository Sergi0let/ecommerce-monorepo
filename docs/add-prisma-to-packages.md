# Налаштування Prisma в Turborepo + pnpm workspaces

Цей документ описує процес додавання Prisma ORM до monorepo на основі Turborepo та pnpm workspaces, включаючи проблеми з якими ми зіткнулися і їх рішення.

## Архітектура

У нашому monorepo Prisma винесена в окремий пакет `@repo/database`, що дозволяє:
- Централізовано управляти схемою БД
- Переіспользувати Prisma Client у різних apps
- Ізолювати БД-логіку від бізнес-логіки

## Структура

```
packages/database/
├── prisma/
│   ├── schema.prisma          # Схема БД
│   └── migrations/            # Міграції
├── src/
│   ├── client.ts              # Налаштований Prisma Client
│   └── index.ts               # Exports для споживачів
├── generated/prisma/          # Згенерований Prisma Client
├── prisma.config.ts           # Конфігурація Prisma
├── package.json
└── tsconfig.json
```

## Крок 1: Створення пакета @repo/database

### 1.1 Структура package.json

```json
{
  "name": "@repo/database",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "check-types": "pnpm db:generate && tsc --noEmit"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^22.15.3",
    "prisma": "^7.8.0",
    "typescript": "5.9.2"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "dotenv": "^17.4.2",
    "pg": "^8.21.0"
  },
  "exports": {
    ".": "./src/index.js"
  }
}
```

**Ключові моменти:**
- `"type": "module"` — використовуємо ESM
- Скрипти для роботи з Prisma (`db:generate`, `db:migrate`)
- `exports` вказує на точку входу для споживачів

### 1.2 Схема Prisma (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"  // Важливо: відносний шлях до generated/
}

datasource db {
  provider = "postgresql"
}

// Моделі...
```

**Важливо:** `output = "../generated/prisma"` — клієнт генерується у `generated/`, а не в `node_modules/.prisma/`

### 1.3 Конфігурація Prisma (prisma.config.ts)

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

## Крок 2: Налаштування TypeScript

### 2.1 TypeScript конфіг для Node пакетів

Створюємо `packages/typescript-config/node.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"]
  }
}
```

### 2.2 tsconfig.json для database пакета

```json
{
  "extends": "@repo/typescript-config/node.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["prisma.config.ts", "src/**/*.ts", "generated/**/*.ts"]
}
```

## Крок 3: Налаштування Turborepo

Додаємо в `turbo.json`:

```json
{
  "tasks": {
    "dev": {
      "dependsOn": ["^db:generate"], 
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build", "^db:generate"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "db:generate": { 
      "cache": false
    }, 
    "db:migrate": { 
      "cache": false
    }, 
    "db:deploy": { 
      "cache": false
    }
  }
}
```

**Ключові моменти:**
- `"dependsOn": ["^db:generate"]` — перед `dev`/`build` генеруємо Prisma Client
- `"cache": false` для БД операцій — вони не кешуються

## Крок 4: Створення Prisma Client wrapper

### 4.1 src/client.ts

```typescript
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 4.2 src/index.ts

```typescript
export { prisma } from "./client.js";
export * from "../generated/prisma/client.js";
```

## Крок 5: Підключення до apps

### 5.1 Додавання залежності

У `apps/api/package.json`:

```json
{
  "devDependencies": {
    "@repo/database": "workspace:*"
  }
}
```

### 5.2 Використання у коді

```typescript
import { prisma, Product } from "@repo/database";

// Використання...
const products = await prisma.product.findMany();
```

## Проблеми та їх рішення

### 1. "Cannot find name 'process'"

**Проблема:** TypeScript не знає про Node.js глобали (`process`, `Buffer`)

**Рішення:**
- Додати `@types/node` в `devDependencies`
- Створити TypeScript конфіг для Node пакетів з `"types": ["node"]`
- Налаштувати наслідування від цього конфігу

### 2. "Cannot find module '../prisma/client'"

**Проблема:** Неправильний шлях до згенерованого Prisma Client

**Рішення:**
- Перевірити `output` у `schema.prisma`
- Виправити import path: `../generated/prisma/client.js`
- Додати `.js` extension для ESM

### 3. "Error: Cannot find module '.../apps/api/dist/main'"

**Проблема:** Nest CLI видаляє `dist/` при старті, але TypeScript incremental cache (`tsbuildinfo`) залишається в корені проекту. TypeScript вважає що збірка актуальна і не генерує файли.

**Рішення:**
```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./dist/.tsbuildinfo"  // Кеш в dist/
  }
}
```

Тепер при видаленні `dist/` кеш також видаляється.

### 4. "EADDRINUSE: address already in use"

**Проблема:** Зависли процеси від попередніх запусків `turbo dev`

**Рішення:**
Додати `predev` script у `apps/api/package.json`:

```json
{
  "scripts": {
    "predev": "sh -c 'fuser -k \"${PORT:-3006}\"/tcp 2>/dev/null || true'",
    "dev": "nest start --watch"
  }
}
```

### 5. Генерація після змін схеми

**Проблема:** Після змін у `schema.prisma` потрібно вручну регенерувати клієнт

**Рішення:**
- `turbo run db:generate` — регенерація для всіх пакетів
- `pnpm --filter @repo/database db:generate` — тільки для database пакета
- Turbo автоматично запускає generate при `dev`/`build` через `dependsOn`

## Команди для роботи

```bash
# Розробка (автоматично генерує Prisma)
pnpm turbo run dev

# Генерація Prisma Client
pnpm turbo run db:generate

# Міграції
pnpm --filter @repo/database db:migrate

# Production deploy
pnpm --filter @repo/database db:deploy

# Перевірка типів
pnpm turbo run check-types
```

## Gitignore

Додати в `packages/database/.gitignore`:

```
node_modules
/generated/prisma
packages/database/generated
.env
```

## Переваги такої архітектури

1. **Централізація:** Вся БД логіка в одному місці
2. **Переіспользування:** Один Prisma Client для всіх apps
3. **Типізація:** TypeScript типи доступні скрізь
4. **Автоматизація:** Turbo автоматично генерує клієнт при потребі
5. **Ізоляція:** БД пакет можна тестувати окремо

## Альтернативи

- Prisma в кожному app окремо (дублювання)
- Глобальний Prisma в корені (монолітно)
- Винесення тільки схеми, Client в apps

Наш підхід (окремий пакет) — найкращий для масштабування і підтримки.