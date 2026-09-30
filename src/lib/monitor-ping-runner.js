import prisma from './prisma.js';
import { pingUrlListSequential } from './monitor-http-ping.js';
import {
  DEFAULT_MONITOR_PING_INTERVAL_MS,
  isMonitorDueForHttpPing
} from './monitor-schedule.js';

function envIntervalMs() {
  const parsed = parseInt(
    process.env.MONITOR_HTTP_PING_FALLBACK_INTERVAL_MS || '',
    10
  );
  return Number.isFinite(parsed) && parsed >= 60000
    ? parsed
    : DEFAULT_MONITOR_PING_INTERVAL_MS;
}

const CONCURRENCY = 5;

async function pingOneMonitor(m, urls) {
  const { allOk, results, totalMs } = await pingUrlListSequential(urls);

  await prisma.$transaction(async (tx) => {
    await tx.cronMonitor.update({
      where: { id: m.id },
      data: {
        lastCheckInAt: new Date(),
        status: allOk ? 'ok' : 'error'
      }
    });

    await tx.monitorCheckIn.create({
      data: {
        monitorId: m.id,
        status: allOk ? 'ok' : 'error',
        environment: m.environment,
        durationMs: totalMs,
        data: { source: 'server_http', results, totalMs, urls }
      }
    });

    await tx.event.create({
      data: {
        projectId: m.projectId,
        issueId: null,
        eventType: 'CHECK_IN',
        promotedEnv: m.environment,
        data: {
          monitor_slug: m.slug,
          status: allOk ? 'ok' : 'error',
          source: 'server_http',
          results,
          totalMs,
          urls
        }
      }
    });
  });

  return { monitorId: m.id, slug: m.slug, allOk, urls, totalMs, results };
}

export async function runMonitorHttpPings(filters = {}) {
  const where = {};
  if (filters.monitorId != null) where.id = filters.monitorId;
  if (filters.projectId != null) where.projectId = filters.projectId;

  const monitors = await prisma.cronMonitor.findMany({ where });
  const now = filters.now instanceof Date ? filters.now : new Date();
  const fallbackIntervalMs = envIntervalMs();

  // Paused monitors are never pinged, even when a manual run is requested for the project
  const due = monitors.filter((m) => {
    const urls = Array.isArray(m.pingUrls) ? m.pingUrls : [];
    if (!urls.length || m.status === 'paused') return false;
    return !(
      filters.respectSchedule &&
      !filters.force &&
      !isMonitorDueForHttpPing(m, now, fallbackIntervalMs)
    );
  });

  // Ping in parallel (bounded): retries with delays used to hold up every monitor queued behind them,
  // and one monitor failing to save must not stop the others.
  const summaries = [];
  let next = 0;
  const worker = async () => {
    while (next < due.length) {
      const m = due[next++];
      try {
        summaries.push(await pingOneMonitor(m, m.pingUrls));
      } catch (error) {
        console.error(`[monitor-ping-runner] monitor ${m.id} (${m.slug}) failed:`, error.message || error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, due.length) }, worker));

  return summaries;
}
