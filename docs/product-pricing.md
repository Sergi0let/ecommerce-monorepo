# Product Pricing

Product prices are stored in the `Price` model. A price always belongs to a
product, and it can optionally belong to a specific product variant.

```prisma
model Price {
  productId String
  variantId String?
}
```

## Product Price

A product-level price has `variantId: null`. This is the base price for the
product.

```json
{
  "productId": "product-uuid",
  "variantId": null,
  "currency": "UAH",
  "amountCents": 50000,
  "compareAtCents": 65000
}
```

`amountCents: 50000` means `500.00 UAH`.

The same request can omit `variantId`:

```json
{
  "productId": "product-uuid",
  "currency": "UAH",
  "amountCents": 50000
}
```

Product-level prices are returned in:

```ts
product.prices
```

## Variant Price

A variant-level price has both `productId` and `variantId`. Use this when
variants have different prices, for example different volume or package size.

```json
{
  "productId": "product-uuid",
  "variantId": "variant-uuid-100ml",
  "currency": "UAH",
  "amountCents": 85000,
  "compareAtCents": 100000
}
```

Variant-level prices are returned inside each variant:

```json
{
  "id": "product-uuid",
  "prices": [
    {
      "variantId": null,
      "amountCents": 50000
    }
  ],
  "variants": [
    {
      "id": "variant-uuid-100ml",
      "sku": "CREAM-100ML",
      "prices": [
        {
          "variantId": "variant-uuid-100ml",
          "amountCents": 85000
        }
      ]
    }
  ]
}
```

## Frontend Price Selection

If no variant is selected, show the base product price:

```ts
const price = product.prices[0];
```

If a variant is selected, prefer the variant price and fall back to the product
price:

```ts
const price = selectedVariant.prices[0] ?? product.prices[0];
```

## Valid Price Periods

`isValidFrom` and `isValidTo` define when a price is active.

```json
{
  "productId": "product-uuid",
  "variantId": "variant-uuid",
  "currency": "UAH",
  "amountCents": 70000,
  "compareAtCents": 90000,
  "isValidFrom": "2026-06-20T00:00:00.000Z",
  "isValidTo": "2026-06-30T23:59:59.000Z"
}
```

The product API includes only currently active prices:

- `isValidFrom` is `null` or less than/equal to now
- `isValidTo` is `null` or greater than/equal to now

## API

Current endpoint:

```http
POST /product-prices
```

Use product-level prices for the base product price and variant-level prices
only when a variant needs its own price.
