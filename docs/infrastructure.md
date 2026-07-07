# 🚀 Deployment Plan

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

Після деплою:

```bash
npx prisma migrate deploy
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

У БД зберігати лише URL.

Приклад:

```text
https://cdn.domain.com/products/iphone/front.webp
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
id
productId
url
alt
sortOrder
isPrimary
createdAt
```

---

# Environment Variables

```env
DATABASE_URL=

R2_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY=
R2_SECRET_KEY=

CDN_URL=https://cdn.domain.com
```

---

# Next.js

Дозволити CDN:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "cdn.domain.com",
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
- [ ] Upload API
- [ ] Sharp optimization
- [ ] CDN Domain
- [ ] Environment Variables
- [ ] Auto Deploy GitHub

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