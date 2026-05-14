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

  const intervalMsRaw = parseInt(
    process.env.MONITOR_HTTP_PINGER_INTERVAL_MS || '60000',
    10
  );
  const intervalMs =
    Number.isFinite(intervalMsRaw) && intervalMsRaw >= 60000 ? intervalMsRaw : 60000;

  console.log(
    `[monitors] Background HTTP pings enabled (poll ${Math.round(intervalMs / 60000)}m)`
  );

  const tick = async () => {
    try {
      const { runMonitorHttpPings } = await import('@/lib/monitor-ping-runner');
      await runMonitorHttpPings({ respectSchedule: true });
    } catch (e) {
      console.error('[monitors] Background ping:', e.message || e);
    }
  };

  await tick();

  setInterval(tick, intervalMs);
}
