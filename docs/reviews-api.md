# Reviews API — storefront і admin integration

Reviews API дозволяє покупцю створювати, редагувати й видаляти лише власний
відгук. Публічна вітрина бачить тільки moderated reviews зі статусом
APPROVED. Admin або manager обробляє чергу модерації та може видалити
будь-який review.

Base URL: /api. Swagger: /api/docs.

~~~text
Customer → POST review → PENDING
Admin/manager → APPROVED або REJECTED
APPROVED → public product page + Product.ratingAvg/ratingCount
Customer edit approved review → PENDING → зникає з public listing
~~~

## Авторизація

Public read endpoints не потребують token:

~~~http
GET /api/reviews
GET /api/reviews/id/:id
~~~

Customer mutations приймають access JWT з access_token httpOnly cookie або
Bearer header:

~~~http
Authorization: Bearer <access-token>
~~~

Для browser cookie flow frontend має передавати credentials:

~~~ts
fetch('/api/reviews', {
  credentials: 'include',
});
~~~

Admin endpoints потребують ролі ADMIN або MANAGER. Роль і userId ніколи не
надсилаються у create/update body: server бере автора з JWT.

## Public storefront

### Список approved reviews

~~~http
GET /api/reviews?productId=<product-uuid>&page=1&limit=10
~~~

Query parameters:

- productId — необов'язковий UUID; для product page його потрібно передавати;
- page — default 1, мінімум 1;
- limit — default 10, від 1 до 100.

Сортування стабільне: createdAt DESC, потім id DESC.

~~~json
{
  "data": [
    {
      "id": "review-uuid",
      "productId": "product-uuid",
      "rating": 5,
      "comment": "Чудовий засіб",
      "verifiedPurchase": false,
      "helpfulCount": 0,
      "createdAt": "2026-09-26T10:00:00.000Z",
      "updatedAt": "2026-09-26T10:00:00.000Z",
      "author": {
        "firstName": "Olena",
        "avatarUrl": "https://cdn.example.com/avatar.webp"
      }
    }
  ],
  "total": 23,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
~~~

Public response навмисно не містить userId, email, role, status або інші
внутрішні user fields. Порожнє data — нормальний стан: продукт ще не має
approved reviews.

### Один public review

~~~http
GET /api/reviews/id/:id
~~~

Endpoint повертає той самий safe public shape, але тільки якщо review має
статус APPROVED. Для PENDING, REJECTED, неіснуючого або malformed UUID API
повертає 404 або 400.

### Дані рейтингу продукту

Product.ratingAvg — Float?, тому storefront може показувати 4.8.
ratingCount — кількість лише approved reviews. Значення оновлюються
транзакційно після approve, reject, author update та delete.

Зберігайте повну точність; округлення — presentation concern:

~~~ts
const displayedRating = product.ratingAvg?.toFixed(1) ?? '—';
~~~

## Customer actions

### Створити review

~~~http
POST /api/reviews
Authorization: Bearer <access-token>
Content-Type: application/json
~~~

~~~json
{
  "productId": "product-uuid",
  "rating": 5,
  "comment": "Чудовий засіб"
}
~~~

Успіх: 201 Created.

Новий review завжди створюється зі статусом PENDING; він не з'явиться у
public listing до approve. Один user може мати лише один review на продукт.
Повторний create повертає 409 Conflict.

Відповідь mutation містить internal review shape:

~~~json
{
  "id": "review-uuid",
  "rating": 5,
  "comment": "Чудовий засіб",
  "status": "PENDING",
  "verifiedPurchase": false,
  "helpfulCount": 0,
  "createdAt": "2026-09-26T10:00:00.000Z",
  "updatedAt": "2026-09-26T10:00:00.000Z",
  "userId": 42,
  "productId": "product-uuid"
}
~~~

### Оновити власний review

~~~http
PUT /api/reviews/id/:id
Authorization: Bearer <access-token>
Content-Type: application/json
~~~

~~~json
{
  "rating": 4,
  "comment": "Оновлений коментар"
}
~~~

Body може містити rating і/або comment. comment: null очищує текст.
API перевіряє ownership: чужий або відсутній review повертає 404.

Будь-яке редагування переводить review у PENDING, навіть якщо він раніше був
APPROVED. Після успішної відповіді storefront має revalidate public listing і
product rating: попередній approved review більше не є публічним.

### Видалити власний review

~~~http
DELETE /api/reviews/:id
Authorization: Bearer <access-token>
~~~

Успіх: 204 No Content. Чужий або відсутній review повертає 404.
Після delete потрібно прибрати review з локального UI і revalidate product
rating/public listing.

## Admin і manager

### Moderation queue

~~~http
GET /api/reviews/admin?status=PENDING&page=1&limit=20
Authorization: Bearer <admin-or-manager-token>
~~~

Підтримуються query parameters:

- status=PENDING|APPROVED|REJECTED — optional;
- productId=<uuid> — optional;
- page, limit — аналогічні public listing.

Відповідь paginated і містить повний Review shape, включно з userId.
Це internal admin response; не використовуйте її для storefront.

### Approve або reject

~~~http
PATCH /api/reviews/id/:id/moderation
Authorization: Bearer <admin-or-manager-token>
Content-Type: application/json
~~~

~~~json
{
  "status": "APPROVED"
}
~~~

Допустимі значення: APPROVED, REJECTED. PENDING встановлюється лише
server-side після customer edit.

Після moderation admin UI має оновити moderation queue. Якщо результат —
APPROVED або review був раніше approved і став REJECTED, storefront має
revalidate product reviews і product rating.

### Видалення moderator-ом

~~~http
DELETE /api/reviews/:id/admin
Authorization: Bearer <admin-or-manager-token>
~~~

Успіх: 204 No Content. Endpoint може видалити review будь-якого автора.

## Помилки і client behavior

- 400 — невалідний UUID, rating поза 1..5, comment довший за 1000 символів
  або невалідний query;
- 401 — access token відсутній, протермінований або user неактивний;
- 403 — customer звернувся до admin endpoint;
- 404 — review не існує, не approved для public access або не належить
  поточному customer;
- 409 — customer уже має review для цього product;
- 503 — після кількох retry не завершилася serializable transaction для
  rating aggregate; повторіть mutation з коротким backoff.

Для public detail не розрізняйте 404 причини в UI: це навмисно не розкриває
наявність pending/rejected review.

## UI integration checklist

### Storefront

- Product page: fetch GET /api/reviews?productId=...
- Показуйте ratingAvg і ratingCount з product API, а не рахуйте їх із
  поточної client-side page.
- Після create показуйте локальне повідомлення «Відгук очікує модерації»;
  не додавайте його до public reviews list.
- Після update/delete revalidate product detail і public reviews page.
- У public card використовуйте author.firstName і author.avatarUrl;
  передбачте fallback для null.

Поточний API не має GET /api/reviews/me. Якщо потрібен persistent екран
«Мої відгуки» після перезавантаження сторінки, його слід додати окремим
authenticated endpoint, який повертає reviews поточного user.

### Admin panel

- Default queue: GET /api/reviews/admin?status=PENDING.
- Після approve/reject revalidate поточну admin page.
- Перед delete показуйте confirmation; 204 не має JSON body.
- Обробляйте 409 як duplicate на create, а 503 — retryable action.

## Перевірки

[reviews.e2e-spec.ts](../apps/api/test/reviews.e2e-spec.ts) покриває public
visibility, safe author view, admin status filter, ownership, duplicate,
APPROVED → PENDING, delete, rating aggregates і concurrent moderation.

~~~bash
pnpm --filter api test:e2e -- test/reviews.e2e-spec.ts
pnpm --filter api check-types
pnpm --filter api lint
~~~
