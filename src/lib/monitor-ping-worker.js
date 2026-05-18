import prisma from './prisma.js';

const MIN_POLL_INTERVAL_MS = 60000;

function parsePollIntervalMs() {
  const raw = parseInt(process.env.MONITOR_HTTP_PINGER_INTERVAL_MS || '60000', 10);
  return Number.isFinite(raw) && raw >= MIN_POLL_INTERVAL_MS ? raw : MIN_POLL_INTERVAL_MS;
}

export function startMonitorPingWorker(options = {}) {
  const intervalMs = options.intervalMs ?? parsePollIntervalMs();
  let stopping = false;
  let timer = null;
  let tickInFlight = false;

  const tick = async () => {
    if (stopping || tickInFlight) return;

    tickInFlight = true;
    try {
      const { runMonitorHttpPings } = await import('./monitor-ping-runner.js');
      const summaries = await runMonitorHttpPings({ respectSchedule: true });
      if (typeof options.onTick === 'function') {
        options.onTick(summaries);
      } else if (summaries.length > 0) {
        console.log(`[monitor-ping-worker] Ran ${summaries.length} monitor(s)`);
      }
    } catch (error) {
      console.error('[monitor-ping-worker]', error.message || error);
    } finally {
      tickInFlight = false;
    }
  };

  const run = async () => {
    console.log(
      `[monitor-ping-worker] Started (poll every ${Math.round(intervalMs / MIN_POLL_INTERVAL_MS)}m)`
    );
    await tick();
    timer = setInterval(tick, intervalMs);
  };

  const stop = async () => {
    stopping = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    await prisma.$disconnect();
  };

  return { run, stop, tick };
}

export async function runMonitorPingWorkerMain() {
  if (!process.env.DATABASE_URL) {
    console.error('[monitor-ping-worker] DATABASE_URL is required');
    process.exit(1);
  }

  const worker = startMonitorPingWorker();
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[monitor-ping-worker] Received ${signal}, shutting down`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  await worker.run();
}
