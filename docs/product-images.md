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

### Поточний стан

Підготовчий етап завершено:

- `ProductImage.url` замінено на `storageKeyBase`, три derivative URLs і dimensions;
- міграція `20260919145346_r2_image_addition_fields` видаляє лише записи
  `https://placehold.co/…`, зупиняючись, якщо є інші зображення;
- seed більше не створює placeholder-записи `ProductImage`;
- response contract перевіряє URL, додатні dimensions і невід'ємний `sortOrder`;
- create input містить тільки metadata; update — `alt`, `sortOrder`, `isPrimary`;
- `POST /api/products/:productId/images` бере `productId` із route, перевіряє
  multipart metadata та належність variant і повертає `201 Created`;
- upload приймає один `file`, генерує три WebP, завантажує їх у storage та
  створює один `ProductImage`; помилки upload/DB запускають компенсацію;
- create/update використовують спільне DB-блокування продукту для primary image;
- delete поки видаляє лише DB record, без storage cleanup.

R2 adapter реалізовано: `StorageModule` підключено до `ProductImagesModule`,
доступні `putObject`, `deleteObject`, `getPublicUrl`, startup validation та
unit-тести. Smoke test у `market-cosmo-dev` пройшов: upload, перевірка bytes і
headers, читання через `https://dev-images.svash.shop`, повторний delete та
підтвердження відсутності об'єктів через S3 API. Тимчасові test objects очищено.
Sharp processor реалізовано й підключено через `ImagesModule`: приймає Buffer,
перевіряє файл і повертає три WebP buffers із фактичними dimensions.
Multipart endpoint і R2/DB orchestration реалізовано. Наступний блок — cleanup
при видаленні image/product/variant та recovery; storefront також ще потрібно
реалізувати. Наявну застосовану міграцію не редагувати; додаткові
зміни БД оформлювати новими міграціями.

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
  selectedVariant.images.length > 0 ? selectedVariant.images : product.images;
```

## 3. Storage architecture

### Production

- bucket `market-cosmo-prod` для оброблених публічних зображень;
- цільовий custom domain для видачі — `images.svash.shop`; його підключення й
  доступність перевірити окремо перед smoke test;
- API працює з R2 через S3-compatible API;
- credentials доступні лише NestJS API;
- окремі buckets або окремі Cloudflare accounts для production і non-production.

Custom domain відкриває публічне читання об'єктів: цей bucket не вважати
приватним сховищем оригіналів. Запис і видалення виконуються з credentials через
S3 API. Не передавати `ACL: 'public-read'` — object ACL у R2 не підтримуються.

### Local development

Перший варіант для розробки — окремий development R2 bucket із власним public
base URL. Альтернатива для локального workflow — MinIO у Docker через той самий
storage interface та окрему конфігурацію S3-compatible adapter.

Unit-тести використовують mock/fake storage. E2E — fake storage або MinIO й
окрему БД через `TEST_DATABASE_URL`. Production bucket не використовується для
локальної розробки або тестів.

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

| Variant     | Максимальний розмір | Призначення                   |
| ----------- | ------------------: | ----------------------------- |
| `thumbnail` |              320 px | картки, мініатюри             |
| `medium`    |              960 px | catalog і mobile product page |
| `large`     |             1600 px | desktop product gallery       |

Правила обробки:

- застосувати EXIF orientation через `sharp().rotate()`;
- видалити EXIF та інші непотрібні metadata;
- не збільшувати маленькі зображення: `withoutEnlargement: true`;
- зберігати aspect ratio через `fit: inside`;
- конвертувати у WebP;
- обмежити кількість вхідних pixels через Sharp;
- приймати лише JPEG, PNG і WebP, перевіряючи фактичний формат та декодування;
- не приймати SVG для цього pipeline;
- GIF та animated PNG/WebP на MVP відхиляти, а не мовчки обрізати до першого frame;
- обмежити кількість одночасних обробок; байтовий ліміт input не обмежує
  споживання RAM декодованими зображеннями.

Профілі й WebP quality `82` винести в `image-profiles.ts`. Processor повертає
три buffers і фактичні dimensions результатів. Максимальні розміри означають
вписування у квадрат `320×320`, `960×960` або `1600×1600` без crop.

Виклик: `await imageProcessor.process(file.buffer)`. Результат має ключі
`thumbnail`, `medium`, `large`; кожен містить `{ buffer, width, height }`.
Для DB dimensions надалі використовувати `result.large.width/height`.
Processor не створює ключів, URL чи записів у БД і не викликає R2.

В одному API process допускаються одночасно два файли за замовчуванням;
derivatives кожного файлу генеруються послідовно. При зайнятих slots новий
виклик одразу отримує `503`, без черги buffers у пам'яті. Slot звільняється
і після успіху, і після помилки. Ліміт окремий для кожної репліки API;
його потрібно підбирати під RAM контейнера. Він не обмежує кількість buffers,
які multipart transport ще тільки приймає: `FileInterceptor` має окремі per-request
limits. Кожен Sharp render має timeout 15 секунд обробки;
це не загальний HTTP deadline і не включає очікування libuv worker.

Помилки processor: `413` для перевищення byte limit, `400` для невалідного
формату, анімації, пошкодженого файлу або pixel limit, відхиленого Sharp;
`413` також можливий при перевищенні dimensions після metadata inspection.
Фактичний формат перевіряється незалежно від client MIME. APNG виявляється за
chunk `acTL`: поле `pages` у Sharp metadata не охоплює animated PNG.
Джерела: [Sharp metadata](https://sharp.pixelplumbing.com/api-input/),
[PNG animation control](https://www.w3.org/TR/png-3/#acTL-chunk),
[Sharp output і timeout](https://sharp.pixelplumbing.com/api-output/).

## 5. Модель даних

Поточна модель уже підтримує три derivative-файли й безпечне визначення ключів
для видалення об'єктів:

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

  @@index([productId])
  @@index([variantId])
  @@index([sortOrder])
  @@index([isPrimary])
}
```

`storageKeyBase` має значення на кшталт
`products/{productId}/{imageId}`. Воно потрібне для видалення всіх derivative
objects без парсингу URL.

`width` і `height` — додатні фактичні dimensions **large-версії** після
orientation та resize, не dimensions оригіналу і не розміри всіх трьох файлів.
`storageKeyBase`, URL і dimensions формує виключно сервер після Sharp/R2.

Порожня галерея є нормальним станом продукту. Placeholder показує frontend;
вигадані storage keys або URL не записуються в `ProductImage`.

Повні URL допустимо зберігати для простого MVP. Якщо CDN-домен очікувано буде
змінюватися, краща альтернатива — зберігати окремі object keys і будувати URL
через `R2_PUBLIC_BASE_URL` у response mapper. Не можна виводити storage credentials або
внутрішній R2 endpoint у публічну відповідь.

Зміна Prisma schema виконується за стандартним flow із
[`db-migration-flow.md`](./db-migration-flow.md).

## 6. API

### Upload endpoint

JSON-заглушку замінено на multipart upload. R2 credentials залишаються на API.

```http
POST /api/products/:productId/images
Content-Type: multipart/form-data
Authorization: Bearer <admin-or-manager-token>
```

Поля:

- `file` — обов'язковий файл;
- `variantId` — optional UUID; відсутність поля означає спільну галерею;
- `alt` — optional text;
- `sortOrder` — optional non-negative integer, default `0`;
- `isPrimary` — optional boolean, default `false`.

У `multipart/form-data` metadata надходить рядками. `UploadProductImageSchema`
у contracts явно розпізнає `"true"`/`"false"` та десяткові невід'ємні цілі числа
до `2147483647` (PostgreSQL Int); інші значення відхиляються.
Не використовувати `z.coerce.boolean()` для `"false"`. Не передавати `null` як
текст для `variantId`; у FormData поле просто пропускається. `alt` у JSON update
залишається nullable для очищення опису.

`productId` береться лише з route. Strict input відхиляє `storageKeyBase`, URL,
dimensions та інші невідомі metadata-поля. Бінарний файл обробляє interceptor,
а request metadata — спільна Zod-схема і тонкий `createZodDto`.

`MulterModule.registerAsync` отримує перевірений `IMAGE_PROCESSING_CONFIG`:
`fileSize` дорівнює `IMAGE_MAX_FILE_SIZE_BYTES`, `files: 1`, `fields: 4`,
`parts: 6`, `fieldSize: 4096` bytes, `fieldNameSize: 100` bytes. Запит із файлом
і всіма чотирма metadata-полями проходить. Повторені scalar-поля, вкладені
metadata, невідоме ім'я file-поля та зайві файли відхиляються.
Multer зберігає input у пам'яті; client MIME не визначає допустимий формат —
це перевіряє Sharp за фактичним вмістом.

Endpoint:

1. guards перевіряють роль `ADMIN` або `MANAGER`;
2. `FileInterceptor('file')` приймає один файл із multipart limits;
3. API перевіряє route ID, metadata, product і належність variant;
4. генерує `imageId` і перевіряє файл через Sharp;
5. створює derivatives у пам'яті з обмеженою паралельністю;
6. завантажує всі три derivatives у R2;
7. створює `ProductImage` і змінює primary image в одній DB transaction;
8. повертає `201` і response, який проходить `ProductImageSchema`.

До завершення upload не тримати DB transaction відкритою. При помилках R2 або
запису в БД виконувати cleanup згідно з розділом 10.

Swagger описує `multipart/form-data`, binary `file` і відповіді:
`201`, `400` (невалідний файл/metadata), `401`, `403`, `404`, `413` (ліміт
розміру файлу), `503` (недоступність storage або зайнятий processor).
Перевищення кількості multipart parts/fields/files або розміру text field дає
`400`. Відповідь `201` перевіряється через `ZodSerializerDto(ProductImagesDto)`;
`createdAt` перед серіалізацією перетворюється на ISO string.

Для ручної перевірки у Postman: `POST` на route вище, Bearer token користувача
`ADMIN`/`MANAGER`, Body → form-data, `file` типу File; решта полів — Text.
`Content-Type` вручну не задавати. У dev environment перевірити три URL з
відповіді та один DB record; ключі мають бути
`products/{productId}/{imageId}/{thumbnail|medium|large}.webp`.

### Metadata operations

```http
PUT    /api/product-images/id/:id
DELETE /api/product-images/:id
GET    /api/product-images/id/:id
```

Це наявні routes, які зберігаємо в межах фічі. `PUT` уже приймає часткове
оновлення metadata: `alt`, `sortOrder`, `isPrimary`. Зміна
`productId` або `variantId` після upload не дозволяється. Для перенесення
зображення між галереями його потрібно видалити і завантажити заново.

Перехід на семантично точніший `PATCH` можна виконати окремою узгодженою API
зміною; він не є передумовою upload.

Наявний глобальний `GET /api/product-images` не потрібен storefront. Для admin
listing, якщо він знадобиться, треба додати pagination і filters, а не повертати
всю таблицю.

## 7. Межі модулів

```text
apps/api/src/
  common/storage/
    object-storage.interface.ts
    r2-storage.config.ts
    r2-storage.service.ts
    storage.module.ts
  common/images/
    images.module.ts
    image-processor.service.ts
    image-profiles.ts
    images.config.ts
    png-animation.ts
  modules/product-images/
    dto/
    product-images.controller.ts
    product-images.service.ts
    product-images.module.ts

packages/contracts/src/product-images/
  inputs/
  schemas/
  types/
```

Відповідальності:

- `ObjectStorage` — interface для put/delete objects, без Prisma і знань про Product;
- `R2StorageService` — один `S3Client` на service, credentials, bucket, storage
  errors і public URLs; приймає `ContentType` та `CacheControl` від caller,
  для derivatives використовуються `image/webp` та immutable cache policy;
- `ImageProcessorService` — validation metadata і генерація derivatives;
- `ProductImagesService` — ownership, primary image, DB/R2 orchestration;
- `@repo/contracts` — request metadata і HTTP response schemas;
- controller — multipart transport, guards і Swagger.

Interface інжектувати через runtime DI token; TypeScript interface сам по собі
не є Nest provider. Реалізований token — `OBJECT_STORAGE`; він посилається на
той самий singleton `R2StorageService`. Інші модулі імпортують `StorageModule`
та інжектують `ObjectStorage` через `@Inject(OBJECT_STORAGE)`.
`storageKeyBase` генерує `ProductImagesService`, а не клієнт.
Наявна response-схема — `ProductImageSchema`; окрема папка `responses/` потрібна
лише якщо HTTP shape відрізнятиметься від сутності.

Storage потрібно сховати за власним interface. Це дає MinIO для local та fake
storage для тестів без умов `if (development)` у доменному service.

## 8. Конфігурація

```env
R2_ACCOUNT_ID=
R2_BUCKET=market-cosmo-prod
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=https://images.svash.shop

IMAGE_MAX_FILE_SIZE_BYTES=10485760
IMAGE_MAX_INPUT_PIXELS=40000000
IMAGE_PROCESSING_CONCURRENCY=2
```

Це приклад production-конфігурації: у development замінити bucket і public
base URL на dev-значення. R2 endpoint будувати з `R2_ACCOUNT_ID`:
`https://<account-id>.r2.cloudflarestorage.com`, region — `auto`.
`R2_ENDPOINT` для звичайного R2 не обов'язковий. MinIO матиме окремі endpoint,
credentials і налаштування path-style addressing у своєму adapter/config.

Env variables мають проходити startup validation. Secrets не комітяться і не
передаються на frontend. Для R2 token потрібно надати доступ лише до потрібного
bucket з мінімально необхідними object read/write permissions.

Три `IMAGE_*` параметри необов'язкові: значення вище є defaults. Якщо задані,
вони мають бути додатними цілими числами; порожнє значення є помилкою.
Zod-конфігурація й allowlist image metadata знаходяться у
`packages/contracts/src/common/images.schema.ts`. `ImagesModule` перевіряє
конфігурацію при запуску API через `ConfigService`.

Startup validation реалізована через `R2StorageConfigSchema` у
`packages/contracts/src/common/storage.schema.ts`. Public base URL повинен бути
HTTPS без credentials, query чи fragment; trailing slash нормалізується.
Помилка запуску містить лише назви некоректних env variables, без їх значень.
Object keys — server-generated ASCII paths до 1024 символів; URL, порожні
segments, `.`/`..`, backslash і percent-encoding відхиляються до S3-запиту.

Adapter використовує до трьох SDK attempts, connection timeout 5 секунд і
загальний deadline операції 30 секунд. SDK errors перетворюються на `503`;
у logs залишаються operation, key і HTTP status, без raw exception/credentials.
Повторне видалення відсутнього key успішне; відсутній bucket або заборона доступу
залишаються помилкою. При закритті Nest module звільняються ресурси S3 client.

Unit-тести запускаються без `.env`, мережі й БД:

```bash
pnpm --filter api test:unit
```

E2E setup задає фіктивні R2 credentials. Для майбутніх upload e2e потрібно
перевизначити provider `OBJECT_STORAGE` на fake storage, щоб не виконувати
зовнішні запити. MinIO adapter ще не реалізовано.

## 9. Validation і security

- максимальний розмір upload: початково 10 MiB;
- allowlist MIME: JPEG, PNG, WebP;
- перевіряти не лише client `Content-Type`, а й реально декодувати файл Sharp;
- встановити `fileSize`, `files: 1`, `fields`, `parts` і `fieldSize` на рівні
  multipart interceptor; `MaxFileSizeValidator` після приймання файлу недостатньо
  для контролю пам'яті під час upload;
- обмежити dimensions/pixel count для захисту від decompression bombs;
- генерувати server-side object keys;
- не включати original filename у public key;
- rate limit admin upload endpoint;
- не дозволяти довільний bucket/key у request body;
- логувати `imageId`, `productId` і результат операції, але не file buffer;
- R2 CORS для server-to-server upload не потрібен; CORS React → NestJS
  налаштовується окремо, CDN/read CORS — лише якщо цього потребує клієнтський сценарій.

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

Реалізовано послідовний upload трьох derivatives. Якщо один upload упав,
компенсація робить best-effort delete усіх трьох server-generated keys нового
зображення, включно з ключем невдалого PUT: storage міг прийняти bytes до
втрати acknowledgement. Cleanup використовує `Promise.allSettled`, тому помилка
одного delete не заважає іншим. Початкова помилка повертається клієнту;
невидалені keys, `imageId` і `productId` логуються без buffers/secrets.

Компенсація також виконується, якщо product/variant зник під час обробки або
DB-транзакція впала. Відкочуються і insert, і зміни primary. Повторне очищення
після збою самого cleanup, аварійного завершення процесу або невизначеного
результату зовнішньої операції потребує recovery job з етапу 4.
Якщо надалі uploads стануть паралельними, потрібно дочекатися завершення всіх
запущених PUT перед компенсацією.

### Primary image і конкурентність

`updateMany(isPrimary: false)` і створення/оновлення primary image виконуються
однією короткою транзакцією в межах `(productId, variantId)`. Реалізація використовує
`SELECT ... FOR UPDATE` на рядку `Product` і явно заданий `ReadCommitted`:
create/update спочатку беруть той самий lock, навіть для порожньої галереї.
Наступний writer читає актуальний стан після звільнення lock. Це замінює
запланований `Serializable` із retries: менше повторних транзакцій, але metadata
зміни різних галерей одного продукту теж короткочасно чекають одна на одну.
Sharp/R2 виконуються до відкриття транзакції.

Update повторно читає image після lock; інші primary скидаються тільки при
явному `isPrimary: true`. Запит лише з `alt` не використовує застарілий
`isPrimary` із попереднього читання. Shared і variant галереї не скидають
primary одна одної. Усі нові writers primary image мають дотримуватися цього
lock-протоколу; окремого DB unique constraint для primary image поки немає.
Деталі механізму: [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

Тест має підтвердити не більше одного primary image у кожній галереї та
незалежність спільної галереї від галерей варіантів.

### Delete

Рекомендований порядок:

1. знайти DB record;
2. видалити R2 objects;
3. видалити DB record.

Видалення об'єктів, яких уже немає, вважати успішним. При частковому R2 failure
залишити DB record для retry; при DB failure після успішного R2 delete повторний
запит має завершити видалення запису. Тимчасово record може посилатися на відсутні
файли — це обмеження синхронного MVP, а не атомарне видалення.

Якщо потрібна вища доступність, advanced implementation використовує стан
`PENDING_DELETE` і outbox/queue. Для MVP синхронний delete прийнятний, але
потрібна періодична job для пошуку orphan objects.

Cascade delete Product/Variant у PostgreSQL сам по собі не видалить objects із
R2. Поточні `ProductService.delete` і `ProductVariantService.delete` виконують
hard delete: потрібно додати storage cleanup до фактичного видалення агрегату,
зберігши правила останнього/default variant. Перед cleanup перевірити, що
видалення дозволене; upload і delete одного агрегату не повинні створювати orphan
objects через гонку. Не тримати DB transaction відкритою під час R2-запитів.

Якщо буде запроваджено soft delete через `deletedAt`, файли зберігати до
остаточного видалення: вони потрібні для відновлення продукту.

### Recovery перед production rollout

- додати retry очищення та orphan cleanup command/job;
- command має спочатку підтримувати dry run зі списком keys;
- обробляти лише відомі product-image prefixes у відповідному bucket;
- пропускати свіжі об'єкти протягом grace period, довшого за максимальну
  тривалість upload і DB retries, щоб не видаляти незавершені uploads;
- перевіряти наявність DB reference перед видаленням, не покладатися лише на logs;
- окремо виявляти DB records із відсутніми файлами після часткового delete.

## 11. Storefront integration

- catalog використовує `thumbnailUrl`;
- product gallery спочатку використовує `mediumUrl`;
- `largeUrl` завантажується для zoom/fullscreen;
- `alt` має бути доступний у product response;
- порожня галерея показує локальний placeholder без запису в `ProductImage`;
- власна галерея варіанта має пріоритет, інакше використовуються спільні images;
- масив сортується за `isPrimary DESC`, потім `sortOrder ASC`;
- `next/image` дозволяє тільки hostname custom CDN domain;
- immutable object keys можна кешувати довго:
  `Cache-Control: public, max-age=31536000, immutable`.

Використовувати lazy loading і responsive `sizes`. Не підставляти dimensions
large-версії як фактичні dimensions thumbnail/medium; зберігати правильне aspect
ratio й перевірити layout на портретних та малих зображеннях.

Заміна файлу створює новий `imageId`/key. Не треба перезаписувати object під тим
самим immutable URL, інакше CDN може довго показувати старе зображення.

## 12. План реалізації

Підготовка моделі, міграції, seed і базових contracts уже виконана, див. розділ 1.
Подальший порядок: **R2 adapter → Sharp → multipart upload → cleanup → storefront**.
Тести додаються в кожному етапі, а не відкладаються до кінця.

### Етап 1 — R2 storage adapter і конфігурація

Етап завершено: код, 33 unit-тести та реальний dev upload/read/delete smoke test
пройшли. Production bucket у перевірці не використовувався.

- додати `@aws-sdk/client-s3`;
- створити `ObjectStorage` interface;
- реалізувати put/delete у R2 adapter без залежності від Prisma;
- додати startup validation, singleton `S3Client` і public URL builder;
- передавати content type і cache headers;
- налаштувати dev bucket і перевірити його public URL;
- unit-тести через mock S3 client: конфігурація, keys, headers, storage errors
  і повторне видалення відсутнього об'єкта.

Критерій готовності: тестовий об'єкт у dev bucket завантажується, відкривається
через public URL та видаляється. Credentials не потрібні для unit-тестів.

```text
feat(api): add R2 storage adapter and config validation
```

### Етап 2 — Sharp image processing

Етап завершено: додано 28 тестів конфігурації та processor, перевірки працюють
із реальним Sharp без R2 і БД; fixtures генеруються в пам'яті.
`pnpm --filter api test:unit` — 61 тест разом із storage suite;
На завершенні цього етапу також проходили наявні 152 e2e-тести.

- додати `sharp`;
- реалізувати validation і metadata inspection;
- генерувати thumbnail/medium/large;
- додати byte/pixel limits і обмежити одночасну обробку;
- повертати три buffers і фактичні dimensions;
- протестувати landscape, portrait, EXIF orientation, small image, corrupted
  file, oversized input, unsupported format та animated PNG/WebP.

Критерій готовності: processor генерує три валідні WebP у межах профілів,
не збільшує маленькі images і відхиляє невалідні файли до storage upload.

```text
feat(api): add validated WebP image processing
```

### Етап 3 — multipart endpoint і заміна заглушки

Етап реалізовано. Інтеграційні тести використовують реальний Sharp,
окрему `TEST_DATABASE_URL` та fake storage без доступу до R2. Перевіряються
формат/кількість objects і DB records, response contract, transport limits,
authorization, ownership, компенсація upload/DB failure, помилка cleanup та
конкурентні primary uploads/updates. Додано 35 unit- і 25 інтеграційних тестів;
повні suites: 96 unit та 177 e2e проходять. Міграція для цього етапу не потрібна.

- додати `@types/multer` як dev dependency; `@nestjs/platform-express` уже є;
- додати `FileInterceptor` з limits і приймання одного `file`;
- додати явний парсинг multipart metadata у contracts зі strict validation;
- зберегти route, role guards і перевірки product/variant ownership;
- зв'язати processing, R2 і Prisma через `ProductImagesService`;
- генерувати UUID keys і всі службові поля тільки на сервері;
- реалізувати конкурентно безпечне перемикання primary image;
- одразу додати cleanup часткових uploads і компенсацію при DB failure;
- замінити `501` на `201` і задокументувати multipart у Swagger.

Критерій готовності: валідний upload створює рівно три objects і один DB record,
response проходить `ProductImageSchema`. Перевірені `401`/`403`, неправильний
product/variant, відсутній файл, заборонені metadata-поля, рядковий `false`,
partial R2 failure, DB failure та паралельні primary uploads/updates.

```text
feat(api): implement multipart product image uploads
```

### Етап 4 — видалення і recovery

- видаляти три derivatives за server-owned `storageKeyBase`;
- забезпечити повторне виконання після часткового storage/DB failure;
- інтегрувати cleanup у hard delete продукту й варіанта;
- при soft delete зберігати файли для відновлення;
- врахувати гонки між upload і видаленням агрегату;
- додати cleanup retry, orphan command/job із dry run і grace period;
- логувати storage failures та результат retry без buffers і secrets.

Критерій готовності: image/product/variant deletion очищає потрібні objects,
не зачіпає чужі галереї, а повторне виконання завершує часткове видалення.
Recovery перевірено для orphan objects і records із відсутніми файлами.

```text
feat(api): clean up stored product images on deletion
```

### Етап 5 — storefront

- перевірити, що product list/detail responses відповідають оновленим contracts;
- налаштувати `next/image` remote pattern;
- реалізувати variant-gallery fallback;
- показувати локальний placeholder для порожньої галереї;
- додати lazy loading і responsive `sizes`;
- перевірити CDN caching headers.

Критерій готовності: catalog, gallery і zoom використовують відповідні URL,
порожні галереї мають fallback, layout коректний на mobile/desktop, заміна
файлу отримує новий URL.

```text
feat(web): render product image derivatives with fallback
```

### Фінальна перевірка MVP

- запустити unit-тести processor, storage і domain orchestration;
- e2e upload/update/delete з fake/MinIO storage та окремою `TEST_DATABASE_URL`;
- перевірити паралельність, authorization і всі error/cleanup сценарії;
- виконати upload/read/delete smoke test із dev R2;
- перевірити docs, Swagger, startup validation, structured logs і recovery;
- перевірити CPU/RAM та upload latency при кількох одночасних запитах.

```bash
pnpm --filter @repo/contracts build
pnpm --filter api test:unit
pnpm --filter @repo/database check-types
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api test:e2e
pnpm --filter web check-types
```

E2E запускаються лише з окремою тестовою БД, налаштованою через
`TEST_DATABASE_URL`. Після frontend-змін також виконати релевантні web lint/build.
Документацію оновлювати разом із відповідним етапом; наведені commit messages —
межі роботи, а не перелік уже створених комітів.

## 13. Definition of Done

- JPEG/PNG/WebP upload створює три WebP derivatives у R2;
- corrupted, oversized, animated і unsupported files відхиляються з `400`/`413`;
- multipart metadata нормалізується, службові поля від клієнта відхиляються;
- product/variant ownership перевіряється;
- лише `ADMIN`/`MANAGER` можуть змінювати галерею;
- primary image invariant зберігається конкурентно безпечно;
- partial upload/DB failure запускає cleanup; невдалий cleanup доступний для
  retry та періодичного reconciliation, включно зі збоєм процесу API;
- delete прибирає DB record і всі derivative objects;
- завершений hard delete product/variant не залишає R2 objects; soft delete,
  якщо він буде реалізований, зберігає файли для відновлення;
- storefront правильно застосовує variant fallback і локальний placeholder;
- обмежені input size, pixels, multipart fields та паралельна обробка;
- smoke test dev R2 підтверджує upload/read/delete і cache headers;
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

Наступний крок масштабування за потреби — presigned upload у приватне тимчасове
сховище й Sharp worker, який публікує лише перевірені derivatives. Це окремий
flow зі статусами обробки та cleanup оригіналів, а не прямий upload довільного
файлу в публічну галерею.

Ці можливості варто додавати лише після вимірювання upload latency, storage
cost і реального навантаження.

## 15. Офіційні джерела для реалізації

- [NestJS file upload](https://docs.nestjs.com/techniques/file-upload) —
  `FileInterceptor`, `UploadedFile`, file validation і Multer typings.
- [Multer](https://github.com/expressjs/multer#limits) — multipart limits і
  memory storage.
- [Cloudflare R2 з AWS SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) —
  endpoint, region і S3 commands.
- [R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/) —
  підтримувані операції, headers та обмеження ACL.
