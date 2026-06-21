# Product and variant model

## Межі відповідальності

`Product` є контентним агрегатом, а `ProductVariant` є конкретною товарною
позицією, яку можна купити.

| Product                          | ProductVariant          |
| -------------------------------- | ----------------------- |
| name, description                | globally unique slug    |
| brand, category                  | SKU                     |
| SEO metadata                     | volume, weight          |
| shared images                    | price history           |
| attributes, ingredients, reviews | inventory               |
|                                  | optional variant images |

Навіть простий товар без вибору кольору чи об'єму має один default-варіант.
`POST /products` тому вимагає `initialVariant` і створює обидва записи однією
транзакцією Prisma.

```json
{
  "name": "CeraVe Hydrating Cleanser",
  "slug": "cerave-hydrating-cleanser",
  "brandId": "brand-uuid",
  "categoryId": "category-uuid",
  "initialVariant": {
    "slug": "cerave-hydrating-cleanser-236ml",
    "sku": "CERAVE-CLEANSER-236ML",
    "name": "236 ml",
    "volumeMl": 236
  }
}
```

## Інваріанти

- продукт створюється щонайменше з одним варіантом;
- `ProductVariant.slug` глобально унікальний;
- `ProductVariant.sku` глобально унікальний;
- продукт має рівно один `isDefault: true` варіант;
- останній варіант продукту не можна видалити;
- ціна та inventory завжди належать варіанту;
- `productId` варіанта не змінюється після створення.

Partial unique index у PostgreSQL гарантує не більше одного default-варіанта.
Створення продукту та правила `ProductVariantService` гарантують, що default
варіант існує.

## Storefront URL та SSG

Публічний URL використовує глобальний slug варіанта:

```text
/products/cerave-hydrating-cleanser-236ml
/products/cerave-hydrating-cleanser-473ml
```

Next.js route:

```text
app/products/[variantSlug]/page.tsx
```

API lookup для сторінки:

```http
GET /products/by-variant/:variantSlug
```

Endpoint повертає продукт, вибраний варіант можна знайти за `variantSlug`, а
решта `product.variants` використовується для перемикача через `<Link>`.

## Зображення

`ProductImage.variantId: null` означає спільне зображення продукту. Якщо
`variantId` заданий, зображення належить конкретному варіанту.
Composite foreign key `(variantId, productId)` не дозволяє прив'язати зображення
до варіанта іншого продукту.

```ts
const images =
  selectedVariant.images.length > 0 ? selectedVariant.images : product.images;
```

Однакові фото двох варіантів зберігаються один раз на рівні продукту. Власна
галерея потрібна лише тоді, коли варіант візуально відрізняється.
