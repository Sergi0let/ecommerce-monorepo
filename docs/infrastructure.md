# 🚀 Deployment Plan

Production rollout Product Images: [checklist конфігурації, міграцій, smoke test і recovery](./product-images-production.md).

## Архітектура

```text
                 GitHub
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
    Vercel                 Render / Koyeb
   (Next.js)                (NestJS API)
        │                       │
        │                       │
        ├──────────────┐        │
        ▼              ▼        ▼
 Cloudflare R2      Neon PostgreSQL
  (Images)           (Database)
```

---

# Frontend

## Vercel

Використовується для деплою Next.js.

Переваги:

- автоматичний деплой з GitHub
- CDN
- Edge Network
- Preview Deployments
- SSR / SSG / ISR підтримуються

---

# Backend

## Render

або

## Koyeb

NestJS API.

Необхідно:

- Environment Variables
- Docker або Build Command
- Auto Deploy з GitHub

---

# Database

## Neon PostgreSQL

Безкоштовний тариф.

Використовувати для:

- users
- products
- orders
- categories
- auth
- sessions

Підключення:

```env
DATABASE_URL=postgresql://...
```

У release job перед запуском нового API, із production DATABASE_URL:

```bash
pnpm --filter @repo/database db:deploy
```

---

# Images

## Cloudflare R2

Зберігати:

- product images
- avatars
- banners
- logos
- pdf
- інші статичні файли

Не зберігати картинки у PostgreSQL.

У БД зберігати URLs, object keys та metadata; бінарні файли — у R2.

Приклад:

```text
https://images.svash.shop/products/{productId}/{imageId}/large.webp
```

---

# Upload Pipeline

```text
User
   │
   ▼
NestJS Upload API
   │
   ▼
Sharp
   │
   ├── convert -> WebP
   ├── resize thumbnail
   ├── resize medium
   └── resize large
   │
   ▼
Cloudflare R2
   │
   ▼
Save URLs into PostgreSQL
```

---

# Product Images

Створювати декілька розмірів:

- thumbnail
- medium
- large

Не використовувати оригінал для відображення на сайті.

---

# Prisma

У ProductImage зберігати:

```ts
id;
productId;
variantId;
storageKeyBase;
thumbnailUrl;
mediumUrl;
largeUrl;
width;
height;
alt;
sortOrder;
isPrimary;
createdAt;
```

---

# Environment Variables

```env
DATABASE_URL=

R2_ACCOUNT_ID=
R2_BUCKET=market-cosmo-prod
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=https://images.svash.shop

IMAGE_MAX_FILE_SIZE_BYTES=10485760
IMAGE_MAX_INPUT_PIXELS=40000000
IMAGE_PROCESSING_CONCURRENCY=2
```

---

# Next.js

Дозволити CDN:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "images.svash.shop",
    },
  ],
}
```

---

# Sharp

Перед завантаженням:

- конвертація WebP
- стискання
- resize
- видалення EXIF
- оптимізація

---

# TODO

## MVP

- [ ] Neon
- [ ] Render або Koyeb
- [ ] Cloudflare R2
- [ ] Prisma migrate
- [x] Upload API — реалізовано; production smoke test ще потрібен
- [x] Sharp optimization — реалізовано й перевірено у dev/test
- [ ] CDN Domain
- [ ] Environment Variables
- [ ] Auto Deploy GitHub
- [ ] Scheduled recovery job та monitoring — див. production checklist

---

# Майбутнє

- Redis (кеш)
- Cloudflare Cache Rules
- Queue (BullMQ)
- Email Service
- S3 Backup
- Monitoring
- Logging (Pino)
- Error Tracking (Sentry)
- Analytics
- Image CDN Optimization
