import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  skipTrailingSlashRedirect: true,
  productionBrowserSourceMaps: true,
};

export default withSentryConfig(nextConfig, {
  // Source-map upload needs SENTRY_AUTH_TOKEN + org/project; without them the build still succeeds
  org: process.env.SENTRY_ORG || undefined,
  project: process.env.SENTRY_PROJECT || undefined,
  silent: !process.env.CI,

  // Browser events via same-origin tunnel (avoids ad-blockers), then forwarded to the DSN host
  tunnelRoute: '/monitoring',

  widenClientFileUpload: true,
  hideSourceMaps: false,

  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
});
