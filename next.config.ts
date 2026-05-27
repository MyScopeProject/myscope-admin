import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

// Sentry build-time wrapper — same as myscope-web. Source-map upload only
// runs when SENTRY_AUTH_TOKEN is set in the Vercel build env. Local builds
// are no-ops for that step.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },
  webpack: { automaticVercelMonitors: false },
});
