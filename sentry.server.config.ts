/**
 * Server-side Sentry init for myscope-admin (Node runtime). Loaded by
 * instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 *
 * Aggressive PII scrubbing — admin routes carry organizer NICs and bank
 * details we never want sitting in Sentry. Anything that looks like a
 * sensitive field in the request body gets blanked.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    tracesSampleRate: 1.0,
    sendDefaultPii: false,

    ignoreErrors: [
      /AbortError/i,
      /Failed to fetch/i,
      /NEXT_REDIRECT/i,
      /NEXT_NOT_FOUND/i,
    ],

    beforeSend(event) {
      if (event.request?.data && typeof event.request.data === 'object') {
        for (const key of [
          'password',
          'token',
          'otp',
          'nic_or_br',
          'bank_account_number',
          'bank_account_name',
          'branch_code',
          'witness_nic',
        ]) {
          // @ts-expect-error — Sentry types data as unknown
          if (key in event.request.data) event.request.data[key] = '[scrubbed]';
        }
      }
      if (event.request?.cookies) {
        event.request.cookies = { __scrubbed: '[hidden]' };
      }
      return event;
    },
  });
}
