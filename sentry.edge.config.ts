/**
 * Edge-runtime Sentry init for myscope-admin. Same minimal init as
 * myscope-web; admin middleware does role-gating on /api/admin/* — anything
 * thrown there ends up here.
 */
import * as Sentry from '@sentry/nextjs';

// Hardcoded fallback DSN — see instrumentation-client.ts header.
const dsn = process.env.SENTRY_DSN
  || process.env.NEXT_PUBLIC_SENTRY_DSN
  || 'https://d6d224b7ac8df876f16e1c4fc4d7c62f@o4511461186732032.ingest.us.sentry.io/4511461394874368';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    tracesSampleRate: 1.0,
    sendDefaultPii: false,
  });
}
