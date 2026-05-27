/**
 * Browser-side Sentry init for myscope-admin. Loaded automatically by
 * Next.js — do not import manually.
 *
 * Posture differs from myscope-web in two ways:
 *   1. Session replay defaults are tighter: admin pages routinely show
 *      organizer NICs, bank account numbers, and payout amounts. Even with
 *      masking, we'd rather not capture those sessions at all.
 *   2. Traces sample rate is 100% — admin traffic is tiny (a handful of
 *      superadmins), so we can afford to trace every request without
 *      blowing the free-tier event quota.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    tracesSampleRate: 1.0,
    sendDefaultPii: false,

    // No session replay on admin — see file header. If you need to debug a
    // specific admin user's session, attach replayIntegration manually
    // behind a feature flag.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      /Failed to fetch/i,
      /NetworkError/i,
      /Load failed/i,
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
