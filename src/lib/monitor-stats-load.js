import prisma from './prisma.js';
import { computeMonitorStats, STATS_MAX_DAYS } from './monitor-stats.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Safety valve for very chatty monitors; newest rows win
const MAX_ROWS = 100000;

/** Stats keyed by monitor id for the given monitors, from the last 30 days of check-ins. */
export async function loadMonitorStats(monitorIds, now = new Date()) {
  const byMonitor = new Map(monitorIds.map((id) => [id, []]));
  if (!monitorIds.length) return new Map();
  const rows = await prisma.monitorCheckIn.findMany({
    where: { monitorId: { in: monitorIds }, createdAt: { gte: new Date(now.getTime() - STATS_MAX_DAYS * DAY_MS) } },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
    select: { monitorId: true, status: true, durationMs: true, createdAt: true }
  });
  rows.forEach((r) => byMonitor.get(r.monitorId)?.push(r));
  const out = new Map();
  byMonitor.forEach((checkIns, id) => out.set(id, computeMonitorStats({ checkIns, now })));
  return out;
}
