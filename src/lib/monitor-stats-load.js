import prisma from './prisma.js';
import { computeMonitorStats, RANGES } from './monitor-stats.js';

// Safety valve for very chatty monitors; newest rows win
const MAX_ROWS = 100000;

/** Stats keyed by monitor id for the given monitors, from the last 30 days of check-ins. */
export async function loadMonitorStats(monitorIds, now = new Date(), range = '30d') {
  const lookbackMs = Math.max(RANGES['30d'].ms, (RANGES[range] || RANGES['30d']).ms);
  const byMonitor = new Map(monitorIds.map((id) => [id, []]));
  if (!monitorIds.length) return new Map();
  const rows = await prisma.monitorCheckIn.findMany({
    where: { monitorId: { in: monitorIds }, createdAt: { gte: new Date(now.getTime() - lookbackMs) } },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
    select: { monitorId: true, status: true, durationMs: true, createdAt: true }
  });
  rows.forEach((r) => byMonitor.get(r.monitorId)?.push(r));
  const out = new Map();
  byMonitor.forEach((checkIns, id) => out.set(id, computeMonitorStats({ checkIns, now, range })));
  return out;
}
