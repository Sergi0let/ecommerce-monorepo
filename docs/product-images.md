# Product Images і Cloudflare R2

## 1. Мета

Реалізувати production-ready завантаження зображень продуктів і варіантів:

```text
Admin client
  -> NestJS multipart endpoint
  -> validate file
  -> Sharp: rotate, strip metadata, resize, WebP
  -> Cloudflare R2
  -> ProductImage metadata у PostgreSQL
  -> CDN URL у storefront
```

Бінарні файли зберігаються у Cloudflare R2. PostgreSQL зберігає тільки
ідентифікатори об'єктів, metadata і зв'язки з доменними сутностями.

## 2. Доменні правила

- `ProductImage.productId` завжди обов'язковий.
- `variantId = null` означає спільне зображення продукту.
- Якщо `variantId` заданий, варіант має належати тому самому продукту.
- Власна галерея варіанта повністю замінює спільну галерею у storefront.
- У межах однієї галереї може бути не більше одного `isPrimary = true`.
- Галерея продукту і галерея кожного варіанта мають незалежне primary-зображення.
- Однакові фото варіантів зберігаються один раз на рівні продукту.
- Оригінальний файл після обробки не використовується у storefront і за
  замовчуванням не зберігається.

Вибір галереї:

```ts
const images =
  selectedVariant.images.length > 0
    ? selectedVariant.images
    : product.images;
```

## 3. Storage architecture

### Production

- приватний Cloudflare R2 bucket;
- public delivery через custom domain, наприклад `cdn.market-cosmo.com`;
- API працює з R2 через S3-compatible API;
- credentials доступні лише NestJS API;
- окремі buckets або окремі Cloudflare accounts для production і non-production.

### Local development

Рекомендований варіант — MinIO у Docker як S3-compatible storage. Це дозволяє
розробляти upload flow без доступу до production R2.

Допустимий спрощений варіант — окремий development R2 bucket. Не можна
використовувати production bucket для локальної розробки або e2e-тестів.

### Object keys

Ключ не повинен залежати від оригінальної назви файлу:

```text
products/{productId}/{imageId}/thumbnail.webp
products/{productId}/{imageId}/medium.webp
products/{productId}/{imageId}/large.webp
```

`imageId` генерується API до upload. UUID робить ключі стабільними та усуває
колізії. Environment не потрібно додавати в key, якщо для середовищ створені
окремі buckets.

## 4. Image derivatives

Початкові профілі:

| Variant | Максимальний розмір | Призначення |
| --- | ---: | --- |
| `thumbnail` | 320 px | картки, мініатюри |
| `medium` | 960 px | catalog і mobile product page |
| `large` | 1600 px | desktop product gallery |

Правила обробки:

- застосувати EXIF orientation через `sharp().rotate()`;
- видалити EXIF та інші непотрібні metadata;
- не збільшувати маленькі зображення: `withoutEnlargement: true`;
- зберігати aspect ratio через `fit: inside`;
- конвертувати у WebP;
- обмежити кількість вхідних pixels через Sharp;
- не приймати SVG для цього pipeline;
- animated GIF/WebP на MVP відхиляти, а не мовчки обрізати до першого frame.

Конкретні quality settings треба винести у конфігурацію, але початково можна
використати WebP quality `82`.

## 5. Модель даних

Поточний `ProductImage.url` недостатній для трьох derivative-файлів і
безпечного видалення об'єктів. Рекомендована MVP-модель:

```prisma
model ProductImage {
  id String @id @default(uuid())

  storageKeyBase String @unique
  thumbnailUrl  String
  mediumUrl     String
  largeUrl      String

  alt       String?
  width     Int
  height    Int
  sortOrder Int     @default(0)
  isPrimary Boolean @default(false)

  createdAt DateTime @default(now())

  productId String
  variantId String?
  product   Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  variant   ProductVariant? @relation(fields: [variantId, productId], references: [id, productId], onDelete: Cascade)
}
```

`storageKeyBase` має значення на кшталт
`products/{productId}/{imageId}`. Воно потрібне для видалення всіх derivative
objects без парсингу URL.

Повні URL допустимо зберігати для простого MVP. Якщо CDN-домен очікувано буде
змінюватися, краща альтернатива — зберігати окремі object keys і будувати URL
через `CDN_URL` у response mapper. Не можна виводити storage credentials або
внутрішній R2 endpoint у публічну відповідь.

Зміна Prisma schema виконується за стандартним flow із
`docs/db-migration-flow.md`.

## 6. API

### Upload

```http
POST /api/products/:productId/images
Content-Type: multipart/form-data
Authorization: Bearer <admin-or-manager-token>
```

Поля:

- `file` — обов'язковий файл;
- `variantId` — nullable UUID;
- `alt` — optional string;
- `sortOrder` — optional non-negative integer;
- `isPrimary` — optional boolean.

Endpoint:

1. перевіряє роль `ADMIN` або `MANAGER`;
2. перевіряє product і належність variant;
3. перевіряє файл;
4. створює derivatives у пам'яті з обмеженим розміром input;
5. завантажує derivatives у R2;
6. створює `ProductImage` у транзакції;
7. повертає `201` і нормалізований response contract.

### Metadata operations

```http
PATCH  /api/product-images/:id
DELETE /api/product-images/:id
GET    /api/product-images/:id
```

`PATCH` змінює лише metadata: `alt`, `sortOrder`, `isPrimary`. Зміна
`productId` або `variantId` після upload не дозволяється. Для перенесення
зображення між галереями його потрібно видалити і завантажити заново.

Окремий глобальний `GET /product-images` не потрібен storefront. Для admin
listing, якщо він знадобиться, треба додати pagination і filters, а не повертати
всю таблицю.

## 7. Межі модулів

```text
apps/api/src/
  common/storage/
    object-storage.interface.ts
    r2-storage.service.ts
    storage.module.ts
  common/images/
    image-processor.service.ts
    image-profiles.ts
  modules/product-images/
    dto/
    product-images.controller.ts
    product-images.service.ts
    product-images.module.ts

packages/contracts/src/product-images/
  inputs/
  responses/
  schemas/
  types/
```

Відповідальності:

- `ObjectStorage` — put/delete objects, без знань про Product;
- `ImageProcessorService` — validation metadata і генерація derivatives;
- `ProductImagesService` — ownership, primary image, DB/R2 orchestration;
- `@repo/contracts` — request metadata і HTTP response schemas;
- controller — multipart transport, guards і Swagger.

Storage потрібно сховати за власним interface. Це дає MinIO для local та fake
storage для тестів без умов `if (development)` у доменному service.

## 8. Конфігурація

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=market-cosmo-production
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=https://cdn.market-cosmo.com

IMAGE_MAX_FILE_SIZE_BYTES=10485760
IMAGE_MAX_INPUT_PIXELS=40000000
```

Env variables мають проходити startup validation. Secrets не комітяться і не
передаються на frontend. Для R2 token потрібно надати доступ лише до потрібного
bucket з мінімально необхідними object read/write permissions.

## 9. Validation і security

- максимальний розмір upload: початково 10 MiB;
- allowlist MIME: JPEG, PNG, WebP;
- перевіряти не лише client `Content-Type`, а й реально декодувати файл Sharp;
- встановити request body/file limits на рівні multipart interceptor;
- обмежити dimensions/pixel count для захисту від decompression bombs;
- генерувати server-side object keys;
- не включати original filename у public key;
- rate limit admin upload endpoint;
- не дозволяти довільний bucket/key у request body;
- логувати `imageId`, `productId` і результат операції, але не file buffer;
- R2 CORS дозволяти лише для CDN/read сценарію; upload виконує API server.

На MVP рекомендується upload через NestJS, а не presigned direct upload: API має
перевірити й перетворити файл до збереження. Direct upload має сенс пізніше для
дуже великих файлів або високого навантаження.

## 10. Consistency і cleanup

R2 і PostgreSQL не підтримують спільну транзакцію. Потрібна compensating logic:

### Upload failure

```text
generate derivatives
-> upload all R2 objects
-> DB transaction
-> якщо DB operation failed, best-effort delete uploaded objects
```

Якщо один із R2 uploads упав, уже завантажені objects також видаляються.
Cleanup failure логуються з усіма object keys і мають бути доступні для retry.

### Delete

Рекомендований порядок:

1. знайти DB record;
2. видалити R2 objects;
3. видалити DB record.

Якщо потрібна вища доступність, advanced implementation використовує стан
`PENDING_DELETE` і outbox/queue. Для MVP синхронний delete прийнятний, але
потрібна періодична job для пошуку orphan objects.

Cascade delete Product/Variant у PostgreSQL сам по собі не видалить objects із
R2. Тому видалення агрегату має проходити через application service, який
спочатку очищає storage. Не можна покладатися лише на Prisma `onDelete: Cascade`.

## 11. Storefront integration

- catalog використовує `thumbnailUrl`;
- product gallery спочатку використовує `mediumUrl`;
- `largeUrl` завантажується для zoom/fullscreen;
- `alt` має бути доступний у product response;
- масив сортується за `isPrimary DESC`, потім `sortOrder ASC`;
- `next/image` дозволяє тільки hostname custom CDN domain;
- immutable object keys можна кешувати довго:
  `Cache-Control: public, max-age=31536000, immutable`.

Заміна файлу створює новий `imageId`/key. Не треба перезаписувати object під тим
самим immutable URL, інакше CDN може довго показувати старе зображення.

## 12. План реалізації

### Етап 1 — контракти і модель

- погодити derivative profiles;
- оновити Prisma `ProductImage`;
- створити й застосувати migration;
- оновити contracts, DTO і product views;
- заборонити зміну ownership через update endpoint.

Результат: API model підтримує три image sizes і стабільні storage keys.

### Етап 2 — storage adapter

- додати `@aws-sdk/client-s3`;
- створити `ObjectStorage` interface;
- реалізувати R2 adapter;
- додати validated configuration;
- реалізувати `putMany`/`deleteMany` з cleanup частково виконаних операцій;
- додати unit-тести adapter orchestration через mock S3 client.

Результат: storage можна замінити без змін у product domain.

### Етап 3 — image processing

- додати `sharp`;
- реалізувати validation і metadata inspection;
- генерувати thumbnail/medium/large;
- додати file size і pixel limits;
- протестувати landscape, portrait, small image, corrupted file та unsupported
  format.

Результат: на storage потрапляють лише нормалізовані WebP derivatives.

### Етап 4 — upload і CRUD integration

- додати multipart upload endpoint;
- зв'язати processing, R2 і Prisma через `ProductImagesService`;
- реалізувати primary-image transaction;
- замінити `PUT` metadata update на `PATCH`;
- реалізувати storage cleanup під час delete;
- задокументувати endpoint-и у Swagger.

Результат: admin/manager може безпечно керувати галереями.

### Етап 5 — storefront

- оновити product list/detail responses;
- налаштувати `next/image` remote pattern;
- реалізувати variant-gallery fallback;
- додати lazy loading і responsive `sizes`;
- перевірити CDN caching headers.

Результат: storefront використовує правильний derivative без завантаження
великих файлів у catalog.

### Етап 6 — quality і operations

- unit-тести processor і domain orchestration;
- e2e upload/update/delete з fake або MinIO storage;
- перевірити authorization і негативні сценарії;
- додати structured logs і storage error metrics;
- задокументувати bucket/custom-domain setup;
- додати orphan cleanup command/job перед production rollout.

## 13. Definition of Done

- JPEG/PNG/WebP upload створює три WebP derivatives у R2;
- corrupted, oversized і unsupported files відхиляються з `400`/`413`;
- product/variant ownership перевіряється;
- лише `ADMIN`/`MANAGER` можуть змінювати галерею;
- primary image invariant зберігається конкурентно безпечно;
- DB failure не залишає звичайних orphan objects;
- delete прибирає DB record і всі derivative objects;
- product deletion не залишає R2 objects;
- storefront правильно застосовує variant fallback;
- contracts build, API typecheck/lint/build і e2e-тести проходять;
- secrets відсутні у git, logs і HTTP responses.

## 14. Не входить у MVP

- відео та animated images;
- client-side direct upload;
- AVIF і автоматичний content negotiation;
- AI background removal або smart crop;
- окремий DAM/media library;
- asynchronous processing через queue;
- deduplication за content hash.

Ці можливості варто додавати лише після вимірювання upload latency, storage
cost і реального навантаження.
