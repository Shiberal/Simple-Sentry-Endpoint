// Client-side Sentry for the monitor UI (browser).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { getSharedSentryOptions } from './sentry.shared.js';

Sentry.init({
  ...getSharedSentryOptions(),
  // Replay needs Sentry SaaS-style storage; leave off for self-hosted sinks
  integrations: [],
});
