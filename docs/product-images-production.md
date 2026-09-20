# Product Images — production rollout

Це список дій перед production-запуском серверної частини Product Images.
Реалізація описана в [product-images.md](./product-images.md), migration flow —
у [db-migration-flow.md](./db-migration-flow.md).

Код перевірений у dev/test. Наведені нижче production-дії ще потрібно виконати;
наявність успішних локальних тестів не означає, що production налаштований.

## 1. Підготувати R2 та домен

- [ ] Перевірити production bucket `market-cosmo-prod` у потрібному account.
- [ ] Підключити `images.svash.shop` через bucket → Settings → Custom Domains;
      дочекатися Active та перевірити HTTPS.
- [ ] Використовувати custom domain для production URL. `r2.dev` призначений
      для development; його public access вимкнути, якщо він не потрібен.
- [ ] Створити окремі production S3 credentials з Object Read & Write тільки
      для цього bucket. API/recovery потрібні PUT, DELETE, HEAD і LIST objects.
- [ ] Перевірити, що dev/preview API не мають production credentials.
- [ ] Не вмикати автоматичне lifecycle-видалення всього `products/`: вік файла
      не означає, що він більше не використовується.

Джерела: [Cloudflare custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[Cloudflare R2 credentials](https://developers.cloudflare.com/r2/api/tokens/).

## 2. Налаштувати environment API та recovery

Задати значення через secrets/environment deployment-платформи. Приклад нижче
не є готовим `.env`: замінити placeholders, не комітити credentials.

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://<production-connection-string>

R2_ACCOUNT_ID=<production-account-id>
R2_BUCKET=market-cosmo-prod
R2_ACCESS_KEY_ID=<production-access-key>
R2_SECRET_ACCESS_KEY=<production-secret-key>
R2_PUBLIC_BASE_URL=https://images.svash.shop

IMAGE_MAX_FILE_SIZE_BYTES=10485760
IMAGE_MAX_INPUT_PIXELS=40000000
IMAGE_PROCESSING_CONCURRENCY=2

CORS_ORIGINS=https://svash.shop
```

- [ ] Перевірити пару **production DATABASE_URL + production R2 bucket** для API
      та recovery job. Змішана конфігурація може зробити живі objects «orphans».
- [ ] Зберегти всі інші потрібні API env: JWT secrets, Google OAuth, mail тощо.
      Цей документ перелічує додаткові налаштування Product Images.
- [ ] Додати точні storefront/admin origins у `CORS_ORIGINS` через кому.
      R2 CORS для NestJS → R2 upload не потрібен.
- [ ] Перевірити RAM під навантаженням: 10 MiB input не обмежує RAM декодованих
      pixels. `IMAGE_PROCESSING_CONCURRENCY` діє на кожну репліку окремо;
      для малого контейнера почати з `1` і виміряти споживання.
- [ ] Перевірити request body limit і timeout reverse proxy/deployment-платформи.
      Body limit має враховувати 10 MiB файлу плюс multipart overhead.
- [ ] Налаштувати rate limit upload route на gateway або в API перед публічним
      запуском; рольова авторизація вже є, окремого rate limiter у модулі немає.

## 3. Зібрати release та застосувати міграції

- [ ] Зафіксувати commit/release, перевірити його у CI та створити backup БД.
- [ ] Перевірити стратегію backup R2: recovery прибирає зайве, але не відновлює
      втрачені зображення. Поточний pipeline не зберігає оригінали.
- [ ] Переглянути pending migrations перед production deploy.

Особливо перевірити `20260919145346_r2_image_addition_fields`, якщо вона ще
не застосована: вона видаляє placeholder-записи `https://placehold.co/...`,
прибирає `url` і додає derivative-поля. За наявності реальних старих images
міграція зупиниться — потрібен окремий план перенесення даних. Не обходити її
перевірку і не редагувати вже застосовану migration history.

`20260919194613_add_image_cleanup_tasks` додає durable cleanup outbox.
Вона має бути застосована до запуску нового API та recovery job.

З кореня checkout у build environment:

```bash
pnpm install --frozen-lockfile
pnpm --filter api build
```

У release/pre-deploy job із production DATABASE_URL:

```bash
pnpm --filter @repo/database db:deploy
```

- [ ] Виконати міграції одним release job, не паралельно кожною API-реплікою.
- [ ] Якщо ще відбувається перехід з `url` на три URL, узгодити maintenance
      window: старий API несумісний зі схемою після цієї міграції.
- [ ] Запустити новий API після успішної міграції:

```bash
pnpm --filter api start
```

- [ ] У runtime artifact залишити Sharp native dependencies, згенерований
      Prisma Client, зібрані workspace packages та `dist/scripts/images-recover.js`.
      Migration job також потребує Prisma CLI, який є dev dependency database.
- [ ] Перевірити startup logs, доступ до PostgreSQL та API HTTPS.

`db:migrate`, `db:reset` і dev seed не є production deployment-командами.

## 4. Виконати production smoke test

Використовувати окремий тестовий продукт із варіантами та токен ADMIN/MANAGER.
Не перевіряти destructive сценарії на реальному товарі.

- [ ] `POST /api/products/:productId/images`: Body → form-data, `file` типу File;
      metadata типу Text. Для shared gallery пропустити `variantId`.
- [ ] Отримати `201`, один `ProductImage` та рівно три `.webp` у production R2.
- [ ] Перевірити `thumbnailUrl`, `mediumUrl`, `largeUrl` через custom domain:
      HTTPS, `image/webp`, правильні dimensions, quality та cache headers.
- [ ] Завантажити variant image, перевірити незалежність його primary від shared.
- [ ] Перевірити `isPrimary=false`, update alt/sortOrder і перемикання primary.
- [ ] Переконатися, що без токена повертається `401`, з CUSTOMER — `403`, а
      неправильний формат/metadata відхиляється без створення objects.
- [ ] Видалити окреме image, потім тестовий variant/product: перевірити DB і
      відсутність їхніх objects через S3 API/bucket dashboard.
- [ ] Повторити DELETE: після завершення cleanup очікується `204`.
- [ ] Прибрати всі створені smoke-test fixtures.

CDN може ще віддавати кешований файл після origin delete. Самої перевірки
старого public URL недостатньо для підтвердження R2 cleanup.
Штучні збої credentials/DB та навантажувальні race-тести виконувати у staging;
вони вже покриті інтеграційними тестами з fake storage і тестовою PostgreSQL.

## 5. Увімкнути recovery за розкладом

- [ ] Спочатку виконати dry run у production environment:

```bash
pnpm --filter api images:recover
```

- [ ] Переглянути `pending-cleanup`, `orphan`, `missing-files`, `invalid-identity`
      і `failure` events. `failures: 0` не означає відсутність orphan/missing files.
- [ ] Після перевірки налаштувати окремий scheduled job на тому самому release
      та production DB/R2 credentials. Початковий розклад — щогодини (`0 * * * *`):

```bash
pnpm --filter api images:recover --apply --grace-hours 24
```

- [ ] Working directory job — корінь monorepo; забезпечити доступність pnpm
      та workspace artifacts. У готовому runtime з cwd `apps/api` еквівалент:
      `node dist/scripts/images-recover.js --apply --grace-hours 24`.
- [ ] У scheduler вимкнути overlapping runs, зберігати logs і відстежувати
      ненульовий exit code, timeout та пропущений запуск.
- [ ] Перевірити перший запуск і зменшення pending cleanup backlog.

Grace 24 години стосується orphan scan та перевірки старих image records;
due cleanup tasks виконуються без очікування цього grace. Мінімальна grace —
1 година. Job робить повний paginated scan product objects та image records:
частоту і runtime limit підбирати за обсягом bucket, тривалістю та кількістю
LIST/HEAD operations. З ростом обсягу варто розділити частий outbox worker і
рідший повний scan окремою зміною коду.

**Не додавати `--remove-broken-records` до регулярного job.** Цей режим видаляє
неповні DB records і решту їхніх derivatives; це ручне рішення після dry run
та перевірки backup/можливості повторного upload.

## 6. Моніторинг та дії при збоях

- [ ] Налаштувати сповіщення про повторні R2 errors, `Upload cleanup deferred`,
      failures recovery, зростання кількості/віку cleanup tasks та OOM API.
- [ ] Контролювати upload latency, `413`, `408`, `503` і використання RAM.
- [ ] Зберігати logs із keys/IDs та attempt/result; не логувати buffers,
      Authorization headers, connection strings або access keys.

Read-only перевірка черги:

```sql
SELECT COUNT(*) AS pending_tasks,
       MIN("createdAt") AS oldest_task,
       MAX(attempts) AS max_attempts
FROM "ImageCleanupTask";
```

DELETE із `503` може означати **DB deletion уже committed**, а R2 cleanup
залишився в черзі. Повторити DELETE або recovery після усунення причини.
Не очищати `ImageCleanupTask` вручну — це список незавершеної роботи.
Missing files автоматично не відновлюються: повернути їх із backup або
завантажити оригінал повторно.

## 7. Rollback і критерій завершення

- [ ] Зберегти попередній сумісний API artifact і порядок його відновлення.
- [ ] При проблемі з release зупинити нові image mutations і apply-job,
      зберегти DB/R2 стан та переглянути logs/dry run.
- [ ] Повертати лише версію API, сумісну з поточною Prisma schema; не запускати
      автоматичний schema rollback або reset. Cleanup table/tasks зберегти.
- [ ] Якщо потрібне відновлення backup, узгодити DB records із відповідними
      R2 objects до повторного ввімкнення destructive recovery.

Rollout завершено, коли production smoke test пройшов, recovery має розклад
і перевірений перший запуск, моніторинг працює, а процедура backup/restore
визначена. Storefront integration перевіряється окремим етапом.
