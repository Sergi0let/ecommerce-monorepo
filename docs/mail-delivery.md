# Transactional email delivery

## Goal

Add a reusable `MailModule` for transactional emails. The first use case is
email verification; later it can send password reset, order, and notification
emails.

Nodemailer is the SMTP client, not the delivery provider. Use Mailpit locally
and an SMTP provider such as Resend, Postmark, or Amazon SES in production.

## Architecture

Mail delivery is an infrastructure module, but this repository currently
organizes infrastructure by Nest module. Keep it in `modules/`, not `common/`:

```text
apps/api/src/modules/mail/
├── mail.module.ts
├── mail.service.ts
├── mail.types.ts
└── templates/
    └── email-verification.template.ts
```

- `MailModule` exports `MailService`.
- `MailService` owns the SMTP transporter and email rendering.
- `AuthService` owns verification token generation, token hashing, expiry, and
  user state changes.
- There is no `MailController`, DTO, Prisma model, or `MailResource`: email
  delivery is not a CRUD domain.
- Do not mark `MailModule` as global. `AuthModule` imports it explicitly; other
  modules import it when they need delivery.

```text
AuthModule ──imports──> MailModule
AuthService ──uses─────> MailService
```

## Dependencies

```bash
pnpm --filter api add nodemailer
pnpm --filter api add -D @types/nodemailer
```

`nodemailer` is a production dependency because the API sends emails at
runtime. `@types/nodemailer` is a development dependency for strict TypeScript
types.

## SMTP configuration

Add these values to `.env.example`. Never commit real credentials.

```env
MAIL_FROM="Market Cosmo <no-reply@example.com>"
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

Production requirements:

- use a verified sender domain;
- configure SPF, DKIM, and DMARC with the chosen provider;
- keep SMTP credentials in the deployment platform's secret store;
- use TLS (`SMTP_SECURE=true`) when the provider requires it.

`MailService` reads configuration through `ConfigService` and creates one SMTP
transporter for the application lifetime. `SMTP_USER` and `SMTP_PASSWORD` are
optional for local SMTP servers such as Mailpit, but must be configured
together when authentication is required.

## Mail service API

```ts
export type SendEmailVerificationInput = {
  to: string;
  verificationUrl: string;
};

export class MailService {
  sendEmailVerification(
    input: SendEmailVerificationInput,
  ): Promise<void>;
}
```

The verification template must include both `html` and `text` variants. Keep
the template function pure: it receives the URL and returns email content.

## Auth integration

`AuthModule` imports `MailModule`. The resend flow becomes:

```text
POST /api/auth/email-verification/resend
  → AuthService generates a cryptographically random raw token
  → transaction stores only SHA-256(token) and expiry
  → AuthService builds WEB_URL/verify-email?token=<raw-token>
  → MailService sends the verification email
  → API returns 204 No Content
```

Build the URL with `URL` and `searchParams.set()` rather than string
concatenation.

```ts
const verificationUrl = new URL('/verify-email', webUrl);
verificationUrl.searchParams.set('token', rawToken);
```

Send the email only after the database transaction commits. If delivery fails,
map the transport error to `503 Service Unavailable` and remove the newly
created verification token. This lets the client retry `resend` immediately.

## Security requirements

- Never log raw verification tokens, URLs containing tokens, or SMTP passwords.
- Store only `SHA-256(rawToken)` in the database.
- Keep the existing one-time use and expiry checks.
- Add a resend cooldown or rate limit, for example one request per user per
  60 seconds.
- Log only safe metadata: message type, provider response ID, and failure
  category.

## Local development

Add Mailpit to `docker-compose.yml`:

```text
SMTP: http://localhost:1025
Web inbox: http://localhost:8025
```

Mailpit lets developers inspect transactional emails locally without real
provider credentials or sending messages to external addresses.

## Tests

1. Unit-test `MailService` with a mocked Nodemailer transporter:
   - SMTP verification;
   - `sendMail` recipient, sender, subject, HTML, and text payload;
   - delivery error mapping without exposing sensitive data.
2. In auth e2e tests, override `MailService` and capture the verification URL.
   Extract its token and verify the complete resend → verify flow without
   reading logs or the database token hash.
3. Manually test the real SMTP integration with Mailpit:
   - email arrives;
   - sender and content are correct;
   - the link verifies the email once;
   - a repeated link returns `400`.

## Scope boundary

Do not add a queue in the first iteration. Sending one verification email
synchronously keeps failure behavior simple. Introduce a queue or a
transactional outbox later if the product needs retries, delivery tracking, or
high-volume email processing.

## Completion checklist

```bash
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api test:e2e
pnpm --filter api build
```

Suggested commit:

```text
feat(api): add transactional email delivery
```
