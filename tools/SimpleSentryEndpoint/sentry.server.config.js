// Server-side Sentry for API routes and SSR.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { getSharedSentryOptions } from './sentry.shared.js';

Sentry.init(getSharedSentryOptions());
