/**
 * Next.js server-side instrumentation hook for myscope-admin. Same shape as
 * myscope-web/instrumentation.ts — dispatches to runtime-specific config
 * files at boot. Each (Node, edge) runtime calls register() once.
 */
export async function register() {
  // Config files live at the project root (not in src/) — match the layout
  // myscope-web uses. The `../` is critical: when this file was moved from
  // the root to src/, the relative paths needed to change with it.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Next.js expects an `onRequestError` export here; @sentry/nextjs ships the
// implementation under `captureRequestError`, re-exported with the right name.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
