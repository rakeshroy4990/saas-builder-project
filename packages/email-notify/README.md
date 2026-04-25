# @your-org/email-notify

Provider-agnostic pluggable email notification library with:

- Password reset (secure hashed token + single-use validation)
- Appointment save confirmation
- Appointment cancellation notice

## Install

```bash
npm install @your-org/email-notify
```

## Resend setup

```ts
import { EmailNotifyService, ITokenStore } from '@your-org/email-notify';

const tokenStore: ITokenStore = {
  async save(token, userId, expiresAt) {
    // Save in your DB
  },
  async find(token) {
    // Return row or null
    return null;
  },
  async invalidate(token) {
    // Delete token row
  },
};

const emailService = new EmailNotifyService(
  {
    provider: 'resend',
    resend: { apiKey: 're_xxxxxxxxx' },
    fromAddress: 'onboarding@resend.dev',
    appBaseUrl: 'https://app.yourdomain.com',
  },
  tokenStore
);
```

Replace `re_xxxxxxxxx` with your real Resend API key before running this in production.

## Env-based initializer (recommended)

```ts
import { createEmailNotifyFromEnv, ITokenStore } from '@your-org/email-notify';

const tokenStore: ITokenStore = {
  async save(token, userId, expiresAt) {},
  async find(token) { return null; },
  async invalidate(token) {},
};

const emailService = createEmailNotifyFromEnv(tokenStore);
```

Required env vars:

- `RESEND_API_KEY` (replace `re_xxxxxxxxx` with your real API key)
- `EMAIL_FROM_ADDRESS` (must be a verified Resend sender)
- `APP_BASE_URL`
- `RESET_TOKEN_TTL_SECONDS` (optional, default is 3600)

## Direct Resend SDK sample

```ts
import { Resend } from 'resend';

const resend = new Resend('re_xxxxxxxxx');

await resend.emails.send({
  from: 'onboarding@resend.dev',
  to: 'rakeshroy4990@gmail.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
});
```

Replace `re_xxxxxxxxx` with your real API key.

## Backend-hospital integration pattern

`backend-hospital` is Java, so this TypeScript package should run as a small Node email service that your Java API calls. Typical flow:

1. Expose endpoints in Node for `sendResetPassword`, `sendAppointmentSave`, and `sendAppointmentCancel`.
2. Initialize with `createEmailNotifyFromEnv(tokenStore)`.
3. Set `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, and `APP_BASE_URL` in that service env.
4. Have `backend-hospital` call this service via HTTP when auth/appointment events occur.
