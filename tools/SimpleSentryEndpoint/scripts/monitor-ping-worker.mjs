import { runMonitorPingWorkerMain } from '../src/lib/monitor-ping-worker.js';

runMonitorPingWorkerMain().catch((error) => {
  console.error('[monitor-ping-worker] Fatal:', error);
  process.exit(1);
});
