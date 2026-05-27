/**
 * Edge-runtime Sentry init for myscope-admin. Same minimal init as
 * myscope-web; admin middleware does role-gating on /api/admin/* — anything
 * thrown there ends up here.
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
  });
}
