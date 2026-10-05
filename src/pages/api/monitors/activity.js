import prisma from '@/lib/prisma';
import { parse } from 'cookie';

function getUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

const SLICE_S = 30 * 60;

/**
 * GET /api/monitors/activity[?projectId=N][&tzOffset=minutes-east-of-UTC]
 * Run counts across every monitor the user can see (or one project): last 24h in 30-minute slices,
 * and the last year per local day.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const projectId = parseInt(req.query.projectId, 10);
  const tzOffset = Math.min(840, Math.max(-720, parseInt(req.query.tzOffset, 10) || 0));

  try {
    const monitors = await prisma.cronMonitor.findMany({
      where: { project: { users: { some: { id: user.userId } } }, ...(isNaN(projectId) ? {} : { projectId }) },
      select: { id: true }
    });
    const ids = monitors.map((x) => x.id);
    if (!ids.length) return res.status(200).json({ success: true, slices: [], days: [] });

    const now = Date.now();
    const lastSlice = Math.floor(now / 1000 / SLICE_S) * SLICE_S;
    const firstSlice = lastSlice - 47 * SLICE_S;
    const [sliceRows, days] = await Promise.all([
      prisma.$queryRaw`
        SELECT (floor(extract(epoch FROM "createdAt") / ${SLICE_S}) * ${SLICE_S})::bigint AS t,
               COUNT(*) FILTER (WHERE status = 'ok')::int AS ok,
               COUNT(*) FILTER (WHERE status = 'error')::int AS error
        FROM "MonitorCheckIn"
        WHERE "monitorId" = ANY(${ids}) AND "createdAt" >= ${new Date(firstSlice * 1000)} AND status IN ('ok', 'error')
        GROUP BY 1`,
      prisma.$queryRaw`
        SELECT to_char("createdAt" + (${tzOffset}::int * interval '1 minute'), 'YYYY-MM-DD') AS date,
               COUNT(*) FILTER (WHERE status = 'ok')::int AS ok,
               COUNT(*) FILTER (WHERE status = 'error')::int AS error,
               ROUND(AVG("durationMs") FILTER (WHERE status = 'ok'))::int AS "avgMs"
        FROM "MonitorCheckIn"
        WHERE "monitorId" = ANY(${ids}) AND "createdAt" >= ${new Date(now - 372 * 86400000)} AND status IN ('ok', 'error')
        GROUP BY 1
        ORDER BY 1`
    ]);
    const byT = new Map(sliceRows.map((r) => [Number(r.t), r]));
    const slices = Array.from({ length: 48 }, (_, i) => {
      const t = firstSlice + i * SLICE_S;
      const r = byT.get(t);
      return { at: new Date(t * 1000).toISOString(), ok: r?.ok || 0, error: r?.error || 0 };
    });
    return res.status(200).json({ success: true, slices, days });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
