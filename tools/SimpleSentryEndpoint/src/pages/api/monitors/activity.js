import prisma from '@/lib/prisma';
import { getSessionUser, visibleMonitorsWhere } from '@/lib/monitor-scope';

const SLICE_S = 5 * 60;

/**
 * GET /api/monitors/activity[?projectId=N][&tzOffset=minutes-east-of-UTC]
 * Run counts across every monitor the user can see (or one project): last 24h in 5-minute slices,
 * and the last year per local day. `perMonitor` has the same 24h slices for each monitor id.
 * Pass `lite=1` to skip `perMonitor` and the year heatmap (mobile-friendly).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const projectId = parseInt(req.query.projectId, 10);
  const tzOffset = Math.min(840, Math.max(-720, parseInt(req.query.tzOffset, 10) || 0));
  const lite = req.query.lite === '1' || req.query.lite === 'true';

  try {
    const monitors = await prisma.cronMonitor.findMany({
      where: { ...visibleMonitorsWhere(user.userId), ...(isNaN(projectId) ? {} : { projectId }) },
      select: { id: true }
    });
    const ids = monitors.map((x) => x.id);
    if (!ids.length) return res.status(200).json({ success: true, slices: [], days: [] });

    const now = Date.now();
    const lastSlice = Math.floor(now / 1000 / SLICE_S) * SLICE_S;
    const firstSlice = lastSlice - 287 * SLICE_S;
    const sliceQuery = prisma.$queryRaw`
        SELECT "monitorId", (floor(extract(epoch FROM "createdAt") / ${SLICE_S}) * ${SLICE_S})::bigint AS t,
               COUNT(*) FILTER (WHERE status = 'ok')::int AS ok,
               COUNT(*) FILTER (WHERE status = 'error')::int AS error
        FROM "MonitorCheckIn"
        WHERE "monitorId" = ANY(${ids}) AND "createdAt" >= ${new Date(firstSlice * 1000)} AND status IN ('ok', 'error')
        GROUP BY 1, 2`;
    const daysQuery = lite ? Promise.resolve([]) : prisma.$queryRaw`
        SELECT to_char("createdAt" + (${tzOffset}::int * interval '1 minute'), 'YYYY-MM-DD') AS date,
               COUNT(*) FILTER (WHERE status = 'ok')::int AS ok,
               COUNT(*) FILTER (WHERE status = 'error')::int AS error,
               ROUND(AVG("durationMs") FILTER (WHERE status = 'ok'))::int AS "avgMs"
        FROM "MonitorCheckIn"
        WHERE "monitorId" = ANY(${ids}) AND "createdAt" >= ${new Date(now - 372 * 86400000)} AND status IN ('ok', 'error')
        GROUP BY 1
        ORDER BY 1`;
    const [sliceRows, days] = await Promise.all([sliceQuery, daysQuery]);
    const empty = () => Array.from({ length: 288 }, (_, i) => ({ at: new Date((firstSlice + i * SLICE_S) * 1000).toISOString(), ok: 0, error: 0 }));
    const slices = empty();
    const perMonitor = lite ? undefined : {};
    for (const r of sliceRows) {
      const i = (Number(r.t) - firstSlice) / SLICE_S;
      if (i < 0 || i >= 288) continue;
      if (perMonitor) (perMonitor[r.monitorId] ||= empty())[i] = { at: slices[i].at, ok: r.ok, error: r.error };
      slices[i].ok += r.ok;
      slices[i].error += r.error;
    }
    return res.status(200).json({ success: true, slices, ...(perMonitor ? { perMonitor } : {}), days });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
