export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config.js');

    const { maybeStartMonitorHttpPingerBackground } = await import(
      './src/lib/monitor-http-pinger-startup.js'
    );
    await maybeStartMonitorHttpPingerBackground();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config.js');
  }
}

export async function onRequestError(...args) {
  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRequestError(...args);
}
