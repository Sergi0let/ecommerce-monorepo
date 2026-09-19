# Prisma migrations: development і тестова БД

## Як створити міграцію після зміни Prisma schema

У цьому проєкті найправильніше діяти так:

1. Зміни схему в `packages/database/prisma/schema.prisma`.
2. Запускаєш міграцію в пакеті бази:
   - з кореня репозиторію: `cd packages/database`;
   - `pnpm db:migrate --name add_user_auth_model`.
3. Prisma сам:
   - створить нову migration;
   - застосує її до локальної development БД.
4. Окремо виконай `pnpm db:generate`, щоб оновити Prisma Client.

### Коли використовувати що

- `pnpm db:migrate`
  - для локальної розробки;
  - найкращий варіант, коли ти змінюєш схему під час розробки.

- `pnpm db:deploy`
  - для тестової БД, CI та production;
  - застосовує вже готові migration-файли без створення нових.

- `pnpm db:reset`
  - тільки якщо хочеш скинути базу і прогнати все заново;
  - підходить для dev, але не для production.

## Як застосувати готові міграції до тестової БД

Міграції створюються один раз у development і зберігаються в
`packages/database/prisma/migrations/`. Тестова БД застосовує ті самі SQL-файли
через `prisma migrate deploy`; окремі міграції для неї не генеруються.

Prisma config читає `DATABASE_URL`, а e2e-тести використовують
`TEST_DATABASE_URL`. Тому для міграцій тестової БД потрібно передати
`TEST_DATABASE_URL` як `DATABASE_URL` **лише дочірньому процесу Prisma**.

### 1. Налаштуй окрему тестову БД

БД `market_cosmo_test` має вже існувати. Її connection string задай у
`apps/api/.env.test.local` або `apps/api/.env`:

```dotenv
TEST_DATABASE_URL=postgresql://<user>:<password>@localhost:5466/market_cosmo_test
```

Підстав свої credentials; не коміть цей файл. Не вказуй тут development або
production БД: auth e2e очищають тестових користувачів і сесії.

### 2. Застосуй міграції

З кореня репозиторію перейди в `apps/api`, де доступний пакет `dotenv` і лежить
конфігурація e2e:

```bash
cd apps/api

node --input-type=module <<'NODE'
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';

config({ path: ['.env.test.local', '.env'], quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required');
}

let target;
try {
  target = new URL(testDatabaseUrl);
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
}

if (
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  target.pathname !== '/market_cosmo_test'
) {
  throw new Error('Expected dedicated market_cosmo_test database');
}

const result = spawnSync(
  'pnpm',
  ['--filter', '@repo/database', 'db:deploy'],
  {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
NODE
```

Команда:

- завантажує `.env.test.local` із пріоритетом над `.env`, як e2e setup;
- перевіряє ім'я тестової БД перед запуском Prisma;
- застосовує відсутні міграції згідно з `_prisma_migrations` у `market_cosmo_test`;
- не переписує `.env` і не змінює `DATABASE_URL` у поточному shell;
- повертає ненульовий exit code, якщо застосування міграцій не вдалося.

Успішний результат — `All migrations have been successfully applied` або
повідомлення, що pending migrations немає. Повторний запуск не застосовує вже
виконані міграції вдруге.

Це не `db:reset`: БД не скидається, але виконується SQL кожної pending migration,
включно з її data changes. Наприклад, міграція ProductImage видаляє
placeholder-записи перед додаванням обов'язкових колонок.

### 3. Онови client і запусти тести

З `apps/api`:

```bash
pnpm --filter @repo/database db:generate
pnpm --filter @repo/contracts build
pnpm --filter api test:unit
pnpm --filter api test:e2e
```

Prisma Client генерується зі спільної `schema.prisma`, окремого client для
тестової БД немає. Після кожної нової development-міграції повторюй крок 2 перед
e2e. Самі `test:unit` і `test:e2e` наразі не застосовують міграції автоматично.

Не запускай два e2e-процеси одночасно на одній тестовій БД, зокрема CLI і Jest
watch у VS Code. `--runInBand` послідовно виконує suites лише всередині одного
процесу; інший процес усе ще може видалити його fixtures.

### Якщо тести падають після зміни схеми

- Catalog endpoints повертають `500`, Prisma повідомляє про відсутню колонку —
  перевір, чи застосовано нову міграцію саме до тестової БД.
- Очікується `403` або `200`, але нестабільно приходить `401` — перевір паралельні
  e2e-запуски: auth suite очищає користувачів, потрібних RBAC suite.
- `TEST_DATABASE_URL is required` — перевір env-файл і запускай через
  `pnpm --filter api test:e2e`, щоб working directory був `apps/api`.

## Після development-міграції

Обов’язково:

- `pnpm db:generate`
- або це робиться автоматично через build, але для впевненості краще запустити.

### Практичний сценарій

Якщо додав, наприклад, нову модель або поле:

- змінюєш schema;
- запускаєш `pnpm db:migrate`;
- даєш назву міграції, наприклад: `add_user_auth_model`;
- перевіряєш, що з’явився файл у migrations;
- запускаєш `pnpm db:seed`, якщо треба оновити тестові дані.

### Важливий момент

Якщо зміни не сумісні з існуючими даними, Prisma може попросити:

- створити SQL-файл через `pnpm db:migrate --create-only --name <name>`;
- відредагувати його: додати backfill або потрібне очищення даних;
- застосувати через `pnpm db:migrate`, потім виконати `pnpm db:generate`.

Застосовані migration-файли не редагувати: Prisma перевіряє їх checksum.

### Рекомендація для твого проєкту

Для початку роби так:

- зміни в schema;
- `pnpm db:migrate`;
- `pnpm db:generate`;
- якщо треба — `pnpm db:seed`.
