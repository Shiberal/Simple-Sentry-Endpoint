export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { maybeStartMonitorHttpPingerBackground } = await import(
    './src/lib/monitor-http-pinger-startup.js'
  );
  await maybeStartMonitorHttpPingerBackground();
}
