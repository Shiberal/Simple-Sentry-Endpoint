/** Optional background pings (Node server process only). */

let started = false;

export async function maybeStartMonitorHttpPingerBackground() {
  if (started) return;
  if (typeof window !== 'undefined') return;
  if (process.env.ENABLE_MONITOR_HTTP_PINGER !== 'true') return;

  started = true;

  const intervalMsRaw = parseInt(
    process.env.MONITOR_HTTP_PINGER_INTERVAL_MS || '300000',
    10
  );
  const intervalMs =
    Number.isFinite(intervalMsRaw) && intervalMsRaw >= 60000 ? intervalMsRaw : 300000;

  console.log(
    `[monitors] Background HTTP pings enabled (${Math.round(intervalMs / 60000)}m)`
  );

  const tick = async () => {
    try {
      const { runMonitorHttpPings } = await import('@/lib/monitor-ping-runner');
      await runMonitorHttpPings();
    } catch (e) {
      console.error('[monitors] Background ping:', e.message || e);
    }
  };

  await tick();

  setInterval(tick, intervalMs);
}
