let started = false;

function isEnabled() {
  const raw = process.env.ENABLE_MONITOR_HTTP_PINGER;
  return raw === 'true' || raw === '1';
}

export async function maybeStartMonitorHttpPingerBackground() {
  if (started) return;
  if (typeof window !== 'undefined') return;
  if (!isEnabled()) return;

  started = true;

  const { startMonitorPingWorker } = await import('./monitor-ping-worker.js');
  const worker = startMonitorPingWorker();
  await worker.run();
}
