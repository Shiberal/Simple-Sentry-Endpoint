import prisma from './prisma.js';
import { computeMonitorHealth } from './monitor-health.js';
import { DEFAULT_MONITOR_PING_INTERVAL_MS } from './monitor-schedule.js';
import { describeFailure, notifyMonitorChange, thresholdReached } from './monitor-alerts.js';

/**
 * Call after a finished check-in (ok or error) has been stored. Moves the monitor between
 * alertState "ok" and "alerting" and sends one notification per transition, never per run.
 * Incidents themselves are derived from check-ins (see monitor-stats.js); alertState only
 * remembers whether the current one has been announced.
 * Never throws: alerting must not break check-in ingest.
 */
export async function evaluateMonitorAlerts(monitorId, { baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '' } = {}) {
  try {
    const monitor = await prisma.cronMonitor.findUnique({ where: { id: monitorId }, include: { project: true } });
    if (!monitor || monitor.status === 'paused') return null;

    const recent = await prisma.monitorCheckIn.findMany({
      where: { monitorId, status: { in: ['ok', 'error'] } },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, monitor.failureThreshold),
      select: { status: true, createdAt: true, data: true }
    });
    if (!recent.length) return null;

    if (monitor.alertState !== 'alerting' && thresholdReached(recent, monitor.failureThreshold)) {
      // Claim the transition first so concurrent workers do not announce it twice
      const claimed = await prisma.cronMonitor.updateMany({
        where: { id: monitorId, alertState: monitor.alertState },
        data: { alertState: 'alerting', alertedAt: new Date() }
      });
      if (claimed.count && monitor.alertsEnabled) {
        await notifyMonitorChange({ kind: 'down', monitor, project: monitor.project, reason: describeFailure(recent[0]), baseUrl });
      }
      return 'down';
    }

    if (monitor.alertState === 'alerting' && recent[0].status === 'ok') {
      const claimed = await prisma.cronMonitor.updateMany({
        where: { id: monitorId, alertState: 'alerting' },
        data: { alertState: 'ok' }
      });
      if (claimed.count && monitor.alertsEnabled) {
        const downForMs = monitor.alertedAt ? Date.now() - new Date(monitor.alertedAt).getTime() : null;
        await notifyMonitorChange({ kind: 'recovered', monitor, project: monitor.project, downForMs, baseUrl });
      }
      return 'recovered';
    }
  } catch (e) {
    console.warn('[monitor-incidents] alert evaluation failed:', e.message || e);
  }
  return null;
}

/**
 * Offline detection for monitors that stopped reporting: no run ever arrives to trigger
 * evaluateMonitorAlerts, so a periodic sweep announces them. Recovery needs no extra code: the next
 * successful check-in goes through evaluateMonitorAlerts, which sends "back online".
 * Never throws.
 */
export async function evaluateMissedMonitors({ now = new Date(), baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '' } = {}) {
  const announced = [];
  try {
    const fallback = parseInt(process.env.MONITOR_HTTP_PING_FALLBACK_INTERVAL_MS || '', 10);
    const fallbackIntervalMs = Number.isFinite(fallback) && fallback >= 60000 ? fallback : DEFAULT_MONITOR_PING_INTERVAL_MS;
    const monitors = await prisma.cronMonitor.findMany({
      where: { alertState: 'ok', status: { not: 'paused' } },
      include: { project: true }
    });
    for (const monitor of monitors) {
      const [latest, lastFinished] = await Promise.all([
        prisma.monitorCheckIn.findFirst({ where: { monitorId: monitor.id }, orderBy: { createdAt: 'desc' }, select: { status: true, createdAt: true } }),
        prisma.monitorCheckIn.findFirst({ where: { monitorId: monitor.id, status: { in: ['ok', 'error'] } }, orderBy: { createdAt: 'desc' }, select: { status: true, createdAt: true } })
      ]);
      const health = computeMonitorHealth({ monitor, latest, lastFinished, now, fallbackIntervalMs });
      if (health.health !== 'missed') continue;

      const claimed = await prisma.cronMonitor.updateMany({
        where: { id: monitor.id, alertState: 'ok' },
        data: { alertState: 'alerting', alertedAt: now }
      });
      if (!claimed.count) continue;
      announced.push(monitor.id);
      if (!monitor.alertsEnabled) continue;
      const stamp = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
      const reason = lastFinished
        ? `No check-in since ${stamp(lastFinished.createdAt)}${health.lastExpectedAt ? ` (expected ${stamp(health.lastExpectedAt)})` : ''}`
        : 'No check-in since the monitor was created';
      await notifyMonitorChange({ kind: 'down', monitor, project: monitor.project, reason, baseUrl });
    }
  } catch (e) {
    console.warn('[monitor-incidents] missed-run sweep failed:', e.message || e);
  }
  return announced;
}
