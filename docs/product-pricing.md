# Product pricing

`ProductVariant` є єдиною продаваною сутністю. Кожен запис `Price` належить
конкретному варіанту; ціни рівня `Product` не існує.

```prisma
model Price {
  id        String @id @default(uuid())
  variantId String
  currency  String @default("UAH")

  amountCents    Int
  costCents      Int?
  compareAtCents Int?

  isValidFrom DateTime?
  isValidTo   DateTime?

  variant ProductVariant @relation(fields: [variantId], references: [id])
}
```

## Чому ціна належить варіанту

Кошик і замовлення завжди працюють із конкретним SKU. Навіть якщо два варіанти
зараз мають однакову ціну, кожен отримує власний запис `Price`:

| Variant                 |      Price |
| ----------------------- | ---------: |
| `cerave-cleanser-236ml` | 500.00 UAH |
| `cerave-cleanser-473ml` | 500.00 UAH |

Однакове числове значення не означає спільне володіння. Окремі записи дають
можливість незалежно змінити ціну одного SKU та зберігати його історію.

## API

Створення ціни:

```http
POST /product-prices
```

```json
{
  "variantId": "variant-uuid",
  "currency": "UAH",
  "amountCents": 50000,
  "compareAtCents": 65000,
  "isValidFrom": "2026-06-20T00:00:00.000Z"
}
```

`amountCents: 50000` означає `500.00 UAH`. `productId` не передається, бо
продукт однозначно визначається через `variant.productId`.

Оновлення ціни змінює лише її значення та період дії. Переприв'язувати існуючу
ціну до іншого варіанта не можна; для іншого варіанта створюється новий запис.

## Активна ціна

Ціна активна, якщо:

- `isValidFrom` дорівнює `null` або не пізніше поточного часу;
- `isValidTo` дорівнює `null` або не раніше поточного часу.

Product API повертає одну актуальну ціну всередині кожного варіанта:

```json
{
  "variants": [
    {
      "slug": "cerave-cleanser-236ml",
      "prices": [
        {
          "variantId": "variant-uuid",
          "amountCents": 50000,
          "currency": "UAH"
        }
      ]
    }
  ]
}
```

На фронтенді немає fallback на `product.prices`:

```ts
const price = selectedVariant.prices[0] ?? null;
```

Порожній масив означає, що активної ціни немає і варіант не можна додати до
кошика, доки storefront явно не визначить іншу поведінку.
