/** Server-side instrumentation: optional background HTTP monitor pings */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  /**
   * Set ENABLE_MONITOR_HTTP_PINGER=true to poll all monitors with URLs.
   * Configure MONITOR_HTTP_PINGER_INTERVAL_MS (min 60000, default 300000).
   */
  const { maybeStartMonitorHttpPingerBackground } = await import(
    './src/lib/monitor-http-pinger-startup.js'
  );
  await maybeStartMonitorHttpPingerBackground();
}
