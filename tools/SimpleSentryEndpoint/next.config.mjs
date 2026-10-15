import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load a dotenv file. If `override` is false, skip keys already set in the environment. */
function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

// Preserve existing installs: still honor a repo-root `.env`, then allow
// tools/SimpleSentryEndpoint/.env to override for tool-specific values.
loadEnvFile(path.join(__dirname, '../../.env'), { override: false });
loadEnvFile(path.join(__dirname, '.env'), { override: true });

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
