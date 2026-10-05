import prisma from './prisma.js';
import { computeMonitorHealth, describeSchedule, healthSeverity } from './monitor-health.js';
import { DEFAULT_MONITOR_PING_INTERVAL_MS } from './monitor-schedule.js';
import { loadMonitorStats } from './monitor-stats-load.js';
import { summarizeProjectStats, RANGES } from './monitor-stats.js';
import { isHeartbeatAlive } from './worker-heartbeat.js';

/**
 * Load monitors matching `where` and shape them for the UI: health, schedule text, recent check-ins,
 * stats (windows, streak, incidents, bucketed series for `range`) and a summary across them.
 */
export async function loadMonitorViews(where, { range = '30d', now = new Date() } = {}) {
  const monitors = await prisma.cronMonitor.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, key: true } },
      checkIns: {
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: { id: true, status: true, durationMs: true, environment: true, data: true, createdAt: true }
      }
    }
  });
  const statsById = await loadMonitorStats(monitors.map((m) => m.id), now, RANGES[range] ? range : '30d');
  const fallbackMs = parseInt(process.env.MONITOR_HTTP_PING_FALLBACK_INTERVAL_MS || '', 10);
  const fallbackIntervalMs = Number.isFinite(fallbackMs) && fallbackMs >= 60000 ? fallbackMs : DEFAULT_MONITOR_PING_INTERVAL_MS;

  const enriched = monitors.map((m) => {
    const recent = m.checkIns; // newest first
    const latest = recent[0] || null;
    const lastFinished = recent.find((c) => c.status !== 'in_progress') || null;
    const health = computeMonitorHealth({ monitor: m, latest, lastFinished, now, fallbackIntervalMs });
    if (health.health === 'failing') {
      const failed = (lastFinished?.data?.results || []).filter((r) => r.ok === false);
      if (failed.length) {
        const why = failed.slice(0, 2).map((r) => {
          let host = r.url;
          try { host = new URL(r.url).host; } catch { /* keep raw */ }
          return `${host}: ${r.status ? `HTTP ${r.status}` : r.error || 'failed'}`;
        }).join('; ');
        health.reason = `Last run failed: ${why}${failed.length > 2 ? ` (+${failed.length - 2} more)` : ''}`;
      }
    }

    const full = statsById.get(m.id);
    const w24 = full.windows['24h'];

    return {
      ...m,
      checkIns: recent.slice(0, 8).map((c) => ({ ...c, source: c.data?.source || 'sdk', results: c.data?.results || null, data: undefined })),
      history: [...recent].reverse().map((c) => ({ status: c.status, durationMs: c.durationMs, at: c.createdAt })),
      health: health.health,
      healthReason: health.reason,
      // Ping monitors without a cron schedule still run, on the default interval
      scheduleText:
        describeSchedule(m.schedule) ||
        (m.pingUrls.length > 0
          ? `Every ${Math.round(fallbackIntervalMs / 60000)} minutes (default, no schedule set)`
          : null),
      nextRunAt: health.nextRunAt,
      lastExpectedAt: health.lastExpectedAt,
      lastRunAt: lastFinished?.createdAt || m.lastCheckInAt || null,
      lastDurationMs: lastFinished?.durationMs ?? null,
      stats: {
        // Kept for older clients
        ok24h: w24.ok,
        error24h: w24.error,
        uptime24h: w24.uptime,
        avgDurationMs: w24.avgMs,
        windows: full.windows,
        streak: full.streak,
        lastSuccessAt: full.lastSuccessAt,
        lastFailureAt: full.lastFailureAt,
        incidents: full.incidents,
        daily: full.daily
      }
    };
  });

  enriched.sort((a, b) => healthSeverity(a.health) - healthSeverity(b.health) || a.slug.localeCompare(b.slug));

  const summary = { total: enriched.length, ok: 0, failing: 0, missed: 0, running: 0, paused: 0, pending: 0, unknown: 0 };
  enriched.forEach((m) => { summary[m.health] += 1; });
  const rollup = summarizeProjectStats(enriched.map((m) => m.stats));
  summary.uptime24h = rollup.windows['24h'].uptime;
  summary.runs24h = rollup.windows['24h'].runs;
  summary.stats = rollup;


  return { monitors: enriched, summary };
}

/** Whether something is driving scheduled pings: worker heartbeats, overdue monitors, config. */
export async function loadSchedulerInfo(enriched, now = new Date()) {
  // Scheduled pings only run if something drives them. Workers report a heartbeat every tick,
  // so we can say whether one is alive instead of guessing from overdue monitors.
  const overduePings = enriched.filter((m) => m.pingUrls.length > 0 && m.health === 'missed').length;
  let beats = [];
  try {
    beats = await prisma.workerHeartbeat.findMany({
      where: { lastTickAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      orderBy: { lastTickAt: 'desc' }
    });
  } catch (e) {
    // Table not created yet (deploy in progress): treat as no heartbeat information
  }
  const workers = beats.map((b) => ({
    id: b.id,
    kind: b.kind,
    startedAt: b.startedAt,
    lastTickAt: b.lastTickAt,
    intervalMs: b.intervalMs,
    ticks: b.ticks,
    lastRan: b.lastRan,
    lastError: b.lastError,
    alive: isHeartbeatAlive(b, now.getTime())
  }));
  const alive = workers.some((w) => w.alive);
  const hasPingMonitors = enriched.some((m) => m.pingUrls.length > 0 && m.status !== 'paused');
  const scheduler = {
    inProcessPinger: process.env.ENABLE_MONITOR_HTTP_PINGER === 'true' || process.env.ENABLE_MONITOR_HTTP_PINGER === '1',
    cronEndpointConfigured: !!String(process.env.MONITOR_CRON_SECRET || '').trim(),
    hasPingMonitors,
    // running: a scheduler ticked recently; stopped: one did before but not lately; never: none ever reported
    state: alive ? 'running' : workers.length ? 'stopped' : 'never',
    workers,
    overduePingMonitors: overduePings,
    warning: hasPingMonitors && (!alive || overduePings > 0)
  };

  return scheduler;
}
