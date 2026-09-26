# Реалізовані API-фічі

Цей файл — бізнес-журнал змін API. Він показує, яку користь дають завершені
фічі, що вони додають і з якими доменами взаємодіють. Технічні деталі endpoint-ів
залишаються в тематичних документах, а незавершені задачі — у
[API roadmap](./api-plan.md).

## Як вести журнал

Додавай запис після завершення вертикальної фічі та її релевантних перевірок.
Описуй бізнес-результат, поведінку для користувача/оператора, пов'язані модулі
й важливі межі. Не копіюй сюди повну API-специфікацію.

Шаблон:

~~~md
## Назва фічі

- Бізнес-користь: яку проблему або процес покращує.
- Можливості: що тепер може користувач або оператор.
- Взаємодії: модулі, дані та події, від яких залежить або які змінює фіча.
- Межі: що свідомо не входить у реалізацію.
- Деталі: посилання на API-документацію або доменні правила.
~~~

## Реалізовані фічі за порядком появи

Порядок нижче визначений за першими тематичними комітами Git. Фічі могли
розвиватися наступними комітами; це послідовність появи основних можливостей,
а не повний список змін чи підтвердження production-релізу.

1. **Каталог: бренди, товари й категорії** — Brand `c407d70` (2026-06-06),
   Category `ef0b1b9` (2026-06-07), Product `667e282` (2026-06-08).
   Listing і доменні контракти уточнювалися наступними червневими комітами.
2. **Варіанти, ціни, склади й залишки** — Warehouse contracts `98c342d`
   (2026-06-16), variant contracts `7d19463` (2026-06-18), variant API
   `fcadf3a` (2026-06-20), price contracts `4ec4dd7` (2026-06-20),
   price/variant API `a27a3a4` (2026-06-21), inventory contracts `8e323a5`
   та API `45fd68d` (2026-06-21). Ingredients contracts `9e5275f`
   (2026-06-21), API `2714e8b` (2026-07-05).
3. **Auth і профіль користувача** — `df7787c` (2026-07-06); cookie
   access/refresh sessions — `1deb3a0` (2026-07-11); Google OAuth —
   `1715032` (2026-07-12).
4. **Відновлення акаунта й email** — password reset `dcd725d` (2026-07-31),
   email verification `2399859` (2026-08-02), transactional email
   `04a6ea9` (2026-08-27), cooldown і відкликання сесій `1f7f309`
   (2026-08-30).
5. **Рольовий доступ** — RBAC і захист catalog endpoints: `744a592`,
   `7f0856d` (2026-09-07).
6. **Зображення товарів** — R2 `99a2435`, WebP processing `cc0e251`,
   multipart upload `3bde6c0`, cleanup/recovery `9f97d38` (2026-09-19).
   Profile/password authorization hardening — `489fa93` (2026-09-20).
7. **Reviews** — Prisma schema `9e05b54` (2026-09-21), contracts `b7f3bcd`
   (2026-09-22), moderation і public/admin API `677baf2` та conflict
   responses `c35d1ae` (2026-09-26).

Дати й subjects звірені з локальною історією Git. SHA — скорочені локальні
ідентифікатори комітів. Вони описують історію цього clone і не гарантують, що
кожен коміт був розгорнутий у production.

## Як фічі пов'язані

~~~mermaid
flowchart LR
  Customer[Покупець] --> Storefront[Storefront]
  Admin[Адмін / менеджер] --> RBAC[JWT + RBAC]
  Storefront --> Catalog[Product catalog]
  Storefront --> PublicReviews[Approved reviews]
  Storefront --> Auth[Auth / User]
  Admin --> RBAC
  RBAC --> Catalog
  RBAC --> Inventory[Inventory management]
  RBAC --> Images[Product images]
  RBAC --> Moderation[Review moderation]
  Catalog --> Product[Product]
  Brand[Brand] --> Product
  Category[Category] --> Product
  Product --> Variant[ProductVariant / SKU]
  Variant --> Price[Price]
  Variant --> Inventory
  Warehouse[Warehouse] --> Inventory
  Product --> Images
  Images --> R2[(Object storage)]
  User[User] --> Review[Review]
  Auth --> User
  Review --> Product
  Moderation --> Review
  Review -->|APPROVED| Rating[Product rating aggregates]
  Rating --> Product
  Inventory -. prerequisite .-> Cart[Cart and checkout — planned]
  Price --> Cart
~~~

## Каталог і складські дані

- **Бізнес-користь:** каталог дає змогу керувати товарами та показувати покупцю
  структуровану інформацію, актуальні ціни й доступність.
- **Можливості:** CRUD брендів, категорій, продуктів та інгредієнтів; product
  listing і lookup; варіанти як окремі SKU; ціни та залишки для варіантів;
  склади; зв'язки продуктів з інгредієнтами й атрибутами.
- **Взаємодії:** Brand і Category групують Product; ProductVariant є SKU;
  Price та Inventory належать варіанту; Warehouse зберігає його залишки.
  Attributes й ingredients доповнюють каталог.
- **Межі:** кошик і атомарне резервування ще не реалізовані; поточний Inventory
  CRUD не є конкурентно-безпечним резервуванням.
- **Деталі:** [варіанти](./product-variants.md), [ціни](./product-pricing.md),
  [склади](./warehouse-domain.md), [listing](./product-listing-guidelines.md).

## Auth, профіль і доступ

- **Бізнес-користь:** покупець може створити акаунт і входити різними
  способами; адміністративні операції мають рольовий захист.
- **Можливості:** local auth, Google OAuth, access/refresh cookies, відкликання
  сесій, відновлення пароля, підтвердження email, оновлення профілю та RBAC.
- **Взаємодії:** JWT визначає користувача для захищених операцій; ролі
  CUSTOMER, ADMIN і MANAGER обмежують доступ до admin endpoints; Auth
  використовує поштові сценарії з Mail module.
- **Межі:** Facebook provider є в enum моделі, але його auth flow не належить до
  зафіксованих реалізованих provider-ів. Production hardening — у
  [roadmap](./api-plan.md#5-перед-публічним-production-запуском).

## Зображення товарів

- **Бізнес-користь:** оператор може завантажити зображення товару, а storefront
  отримує оптимізовані файли для різних місць відображення.
- **Можливості:** multipart upload, валідація й WebP processing, зберігання в
  R2, спільне зображення продукту або зображення конкретного варіанта.
  Видалення запускає cleanup/recovery flow для storage objects.
- **Взаємодії:** ProductImage належить Product і опційно ProductVariant;
  storage adapter, image processor і cleanup tasks координують R2 та PostgreSQL.
- **Межі:** storefront UI і production rollout/monitoring описані як окремі задачі.
- **Деталі:** [API та upload flow](./product-images.md),
  [production rollout](./product-images-production.md).

## Reviews і модерація відгуків

- **Бізнес-користь:** відгуки допомагають покупцям оцінити товар; модерація
  зменшує ризик публікації небажаного контенту. Product rating формується лише
  зі схвалених відгуків.
- **Можливості:** покупець створює, редагує та видаляє власний відгук; зміни
  потребують повторної модерації. Адміністратор або менеджер переглядає чергу,
  схвалює чи відхиляє відгуки. Storefront отримує paginated список схвалених
  відгуків із безпечним author summary.
- **Взаємодії:** JWT визначає автора; Review пов'язує User і Product;
  Product.ratingAvg та ratingCount перераховуються транзакційно з APPROVED
  reviews. Унікальність user/product у БД обмежує автора одним відгуком на товар.
- **Межі:** verifiedPurchase поки не підтверджується замовленням і не може
  задаватися клієнтом. Серверна перевірка покупки запланована після Orders.
- **Деталі:** [Reviews API для storefront і admin](./reviews-api.md),
  [майбутній verified purchase](./api-plan.md#4-подальші-продуктові-задачі).
