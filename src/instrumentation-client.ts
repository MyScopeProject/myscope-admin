/**
 * Browser-side Sentry init for myscope-admin. Lives in `src/` because the
 * project uses the `src/app/` layout; Next.js won't pick it up at the
 * project root in that case.
 *
 * History: previously exported `Sentry.captureRouterTransitionStart` which
 * is undefined in `@sentry/nextjs` v10.54. The export itself is harmless
 * (exporting undefined doesn't throw), but Next.js may try to call it during
 * navigation. Removed it to be safe.
 *
 * Posture: traces sampled at 100% (admin traffic is tiny). No session
 * replay — admin pages routinely show organizer NICs and bank details.
 */
import * as Sentry from '@sentry/nextjs';

// Hardcoded fallback DSN. Sentry DSNs are public-safe (they ship to every
// browser bundle anyway). Env var still wins if set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  || 'https://d6d224b7ac8df876f16e1c4fc4d7c62f@o4511461186732032.ingest.us.sentry.io/4511461394874368';

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  tracesSampleRate: 1.0,
  sendDefaultPii: false,

  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /Failed to fetch/i,
    /NetworkError/i,
    /Load failed/i,
  ],
});

// Next.js 16 / Sentry v10 prints "ACTION REQUIRED: export onRouterTransitionStart…"
// on boot. The real helper (Sentry.captureRouterTransitionStart) is undefined
// in @sentry/nextjs v10.54 — wiring it triggered the navigation crash we
// hit before. A no-op stub satisfies the runtime check without re-introducing
// the crash. Replace with the real helper if/when we bump @sentry/nextjs.
export const onRouterTransitionStart = () => {};
