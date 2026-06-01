# Додавання NestJS у Turborepo

NestJS додається як окремий app у `apps/api`. Не використовуйте вбудований monorepo режим NestJS — оркестрацію вже робить Turbo.

## 1. Створити app

```bash
pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git
```

## 2. TypeScript config

**`packages/typescript-config/nestjs.json`** — preset для NestJS (extends `base.json`):

- `module: CommonJS`, `emitDecoratorMetadata`, `experimentalDecorators`
- `declaration: false`, **`declarationMap: false`** — обов'язково, інакше конфлікт з `base.json`

**`apps/api/tsconfig.json`:**

```json
{
  "extends": "@repo/typescript-config/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 3. ESLint config

**`packages/eslint-config/nest.js`** — export `nestJsConfig`, extends `base.js` (як `next.js`).

**`packages/eslint-config/package.json`** — додати export і залежність:

```json
"exports": {
  "./nest-js": "./nest.js"
},
"devDependencies": {
  "eslint-plugin-prettier": "^5.2.2"
}
```

> Пакет називається `eslint-plugin-prettier`, а не `@eslint-plugin-prettier/recommended` — `/recommended` це шлях імпорту.

**`apps/api/eslint.config.mjs`:**

```js
import { nestJsConfig } from "@repo/eslint-config/nest-js";

/** @type {import("eslint").Linter.Config[]} */
export default nestJsConfig;
```

## 4. package.json

**`apps/api/package.json`** — мінімальні scripts і workspace deps:

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "eslint": "^9.39.1",
    "typescript": "5.9.2"
  }
}
```

Після змін — `pnpm install` з кореня репозиторію.

## 5. Turbo

**`turbo.json`** (root) — додати `dist/**` до build outputs:

```json
"outputs": [".next/**", "!.next/cache/**", "dist/**"]
```

**`apps/api/turbo.json`** (опційно):

```json
{
  "extends": ["//"],
  "tasks": {
    "build": { "outputs": ["dist/**"] }
  }
}
```

## 6. Інше

- **`apps/api/.gitignore`** — `/dist`, `*.tsbuildinfo`
- **Порт** — у `main.ts` використовуйте окремий порт (напр. `3333`), щоб не конфліктувати з Next.js
- **`void bootstrap()`** — у `main.ts`, щоб уникнути floating promise warning

## Запуск

```bash
pnpm install
pnpm --filter api dev        # тільки API
pnpm dev                     # всі apps
pnpm --filter api check-types
pnpm --filter api lint
```

## Типові помилки

| Помилка | Причина | Рішення |
|---------|---------|---------|
| `File '@repo/typescript-config/nestjs.json' not found` | Workspace dep не встановлений | `pnpm install` з кореня |
| `declarationMap cannot be specified without declaration` | `base.json` має `declarationMap: true`, а nestjs override лише `declaration: false` | Додати `"declarationMap": false` у `nestjs.json` |
| `404 @eslint-plugin-prettier/recommended` | Неправильна назва пакета в `package.json` | Використовувати `eslint-plugin-prettier` |
| `nestJsConfig` not found | Default export замість named | `export const nestJsConfig` у `nest.js` + export `"./nest-js"` |
| `eslint` command not found | Немає eslint у `apps/api` | Додати `"eslint": "^9.39.1"` у devDependencies |
