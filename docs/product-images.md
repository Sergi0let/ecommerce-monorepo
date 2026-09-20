# Product Images і Cloudflare R2

API приймає зображення продукту або його варіанта, створює три WebP-версії
та завантажує їх у Cloudflare R2. PostgreSQL зберігає URL, ключі об'єктів,
метадані та зв'язки з продуктом і варіантом. Оригінальний файл не зберігається.

```text
Admin → multipart endpoint → ImagesModule → StorageModule → ProductImage у БД
```

## Де описана реалізація

- [ImagesModule](../apps/api/src/common/images/docs/images.md) — перевірка
  файла, Sharp pipeline, профілі розмірів, WebP та EXIF.
- [StorageModule](../apps/api/src/common/storage/docs/storage-module.md) —
  контракт сховища, dependency injection, R2 adapter та заміна провайдера.
- [Створення зображення](../apps/api/src/modules/product-images/docs/create-product-images.md) —
  `create()`, порядок запису в R2 і БД, `lockImageProduct()` та `cleanupUpload()`.
- [Production rollout](./product-images-production.md) — конфігурація
  середовища, запуск recovery, smoke test і відновлення після збоїв.

## Галереї та модель даних

- `productId` обов'язковий; `variantId = null` означає спільну галерею продукту.
- Якщо `variantId` заданий, варіант має належати цьому продукту.
- Кожна галерея має не більше одного `isPrimary = true`; головні зображення
  спільної галереї та різних варіантів незалежні.
- Порожня галерея допустима. Placeholder не зберігається як `ProductImage`.

[Модель ProductImage](../packages/database/prisma/schema.prisma) містить:

- `id`, `productId`, nullable `variantId` — ідентифікатор і власник;
- `storageKeyBase` — спільний префікс трьох об'єктів у R2;
- `thumbnailUrl`, `mediumUrl`, `largeUrl` — публічні адреси;
- `width`, `height` — фактичні розміри **large-версії** після обробки;
- `alt`, `sortOrder`, `isPrimary`, `createdAt` — метадані зображення.

Сервер генерує UUID і ключі незалежно від оригінальної назви файла:

```text
products/{productId}/{imageId}/thumbnail.webp
products/{productId}/{imageId}/medium.webp
products/{productId}/{imageId}/large.webp
```

`storageKeyBase` дорівнює `products/{productId}/{imageId}`. Cleanup відновлює
ключі з цього поля та звіряє їх з IDs; парсити публічні URL для видалення не потрібно.
Повні URL зберігаються в БД, тому зміна `R2_PUBLIC_BASE_URL` сама по собі
не оновлює адреси наявних зображень.

## API

Routes визначені в
[ProductImagesController](../apps/api/src/modules/product-images/product-images.controller.ts).
Зміни доступні ролям `ADMIN` і `MANAGER`.

### Завантаження

```http
POST /api/products/:productId/images
Content-Type: multipart/form-data
Authorization: Bearer <admin-or-manager-token>
```

Поля запиту:

- `file` — один обов'язковий файл JPEG, PNG або WebP без анімації;
- `variantId` — необов'язковий UUID; для спільної галереї поле пропускається;
- `alt` — необов'язковий текст;
- `sortOrder` — невід'ємне ціле число до `2147483647`, default `0`;
- `isPrimary` — `true` або `false`, default `false`.

Multipart-поля надходять рядками. Парсинг і strict validation визначені в
[UploadProductImageSchema](../packages/contracts/src/product-images/inputs/upload-product-image.schema.ts).
`productId` береться з route; URL, ключі та dimensions формує сервер.
У FormData не передається текст `"null"` замість відсутнього `variantId`.

Multer приймає файл у пам'ять із лімітами розміру, кількості файлів і полів.
Sharp перевіряє фактичний вміст незалежно від client MIME. Після обробки
API послідовно завантажує три файли, потім у короткій DB-транзакції повторно
перевіряє власника, змінює primary за потреби та створює один `ProductImage`.
Sharp і R2-запити виконуються поза DB-транзакцією.

Успішна відповідь — `201` із
[ProductImageSchema](../packages/contracts/src/product-images/schemas/product-images.schema.ts);
`createdAt` серіалізується в ISO string. Основні помилки:

- `400` — невалідні metadata, формат, анімація, пошкоджений файл або відхилення Sharp;
- `401` / `403` — немає автентифікації або потрібної ролі;
- `404` — продукт або відповідний варіант не знайдений;
- `408` — після отримання product lock виявлено прострочений upload;
- `413` — перевищено byte limit або pixel limit під час явної перевірки dimensions;
- `503` — processor зайнятий або storage недоступний.

### Оновлення, читання та видалення

```http
PUT    /api/product-images/id/:id
DELETE /api/product-images/:id
GET    /api/product-images/id/:id
GET    /api/product-images
```

`PUT` частково оновлює `alt`, `sortOrder`, `isPrimary`; `alt: null` очищує опис.
Власника й файл цей endpoint не змінює. Глобальний `GET` повертає всі зображення
без pagination, у порядку `createdAt DESC`.

Заміна файла складається із завантаження нового зображення та видалення старого
після успішного upload. Новий файл отримує новий `imageId` і URL. Ці два запити
не є атомарною операцією. Об'єкти мають
`Cache-Control: public, max-age=31536000, immutable`.

## Узгодженість БД і R2

Спільної транзакції між PostgreSQL і R2 немає. При помилці upload або запису
в БД `cleanupUpload()` спочатку перевіряє результат commit: якщо `ProductImage`
існує, файли зберігаються. Якщо запису немає, створюються durable cleanup tasks
для всіх трьох ключів. За недоступної БД файли залишаються до recovery.
Детальний алгоритм — у [поясненні create()](../apps/api/src/modules/product-images/docs/create-product-images.md).

Create/update серіалізують зміни через `SELECT ... FOR UPDATE` на рядку продукту
та `ReadCommitted`. Це працює і для порожньої галереї, але зміни різних галерей
одного продукту також чекають одна на одну. Окремого unique constraint для
primary немає: інваріант залежить від спільного lock-протоколу.

### Видалення та cleanup

[ImageCleanupService](../apps/api/src/modules/product-images/image-cleanup.service.ts)
використовує transactional outbox:

1. DB-транзакція бере product lock, додає `ImageCleanupTask` для кожного файла
   та видаляє записи зображень.
2. Після commit сервіс видаляє об'єкти з R2.
3. Успішне видалення прибирає task; невдале залишає його для повторної спроби.

Task містить ключ, IDs, кількість спроб і `nextAttemptAt`. Foreign keys відсутні,
щоб задачі переживали видалення продукту чи варіанта. Перед видаленням файла
повторно перевіряються посилання в БД; об'єкти живого `ProductImage` зберігаються.

Cleanup виконує до трьох спроб на ключ із паузами 100/200 ms; SDK має власні
retries. Невдала спроба відкладає наступну scheduled обробку на хвилину.
Повторний `DELETE` запускає cleanup одразу. Якщо R2 cleanup не завершився,
endpoint повертає `503`, хоча запис у БД уже видалений. Після завершення cleanup
повторний `DELETE` повертає `204`; відсутній об'єкт у R2 не є помилкою.

Hard delete продукту очищає всі його галереї, варіанта — лише власну.
Зміна `deletedAt` або `isActive` не запускає cleanup; recovery враховує також
посилання неактивних і soft-deleted продуктів.

### Recovery

[ImageRecoveryService](../apps/api/src/modules/product-images/image-recovery.service.ts)
обробляє pending tasks, знаходить старі об'єкти без запису в БД та записи
з відсутніми файлами. Читання відбувається сторінками по 100 записів.

Команда з кореня repo після збірки API:

```bash
pnpm --filter api images:recover
```

За замовчуванням це dry run без змін даних. `--apply` виконує cleanup tasks
і видаляє orphan objects. `--grace-hours` задає мінімальний вік об'єктів для
orphan scan: default 24 години, мінімум 1 година. Pending tasks обробляються
за `nextAttemptAt`, незалежно від orphan grace.

Перед orphan delete перевіряються DB references та актуальний HEAD timestamp.
Missing files потрапляють у звіт; записи з ними видаляються лише з окремим
`--remove-broken-records` разом із `--apply`. Recovery не відновлює втрачені файли.
Розклад не створюється автоматично. Команди запуску, конфігурація DB/bucket
і правила застосування описані в [production guide](./product-images-production.md).

## Використання галереї клієнтом

Правило вибору: власна галерея варіанта має пріоритет, за її відсутності
використовується спільна галерея продукту. Порядок показу — `isPrimary DESC`,
потім `sortOrder ASC`; порожня галерея потребує локального placeholder.
Це правила інтеграції клієнта, а не підтвердження готовності storefront.

API надає `thumbnailUrl`, `mediumUrl` і `largeUrl`; межі розмірів описані в
[ImagesModule](../apps/api/src/common/images/docs/images.md).
`width`/`height` у відповіді належать large-версії. CDN може ще віддавати кешований
файл після його видалення з R2.

## Перевірки

- [images.unit-spec.ts](../apps/api/test/images.unit-spec.ts) — Sharp, формати,
  розміри, EXIF, прозорість та ліміти.
- [product-images.e2e-spec.ts](../apps/api/test/product-images.e2e-spec.ts) —
  upload/update/delete, конкурентність, compensation і recovery з fake storage
  та окремою тестовою БД.

Налаштування середовища й команди перевірки наведені в
[production guide](./product-images-production.md).
