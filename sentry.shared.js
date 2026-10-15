/**
 * Shared options for the monitor app reporting into its own (or another) ingest.
 * DSN public key is safe in the browser; override with NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN.
 */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  process.env.SENTRY_DSN ||
  'https://f6316a1d09d57448f7bc3da188b2868b@error-sink.dev.agoracloud.it/2';

export function getSharedSentryOptions() {
  const traces = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
  return {
    dsn: SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    tracesSampleRate: Number.isFinite(traces) ? traces : 0.1,
    debug: process.env.SENTRY_DEBUG === '1',
    // Self-hosted ingest often has limited replay support; keep off unless explicitly enabled
    enableLogs: false,
  };
}
