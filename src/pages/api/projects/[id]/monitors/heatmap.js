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

/**
 * GET /api/projects/:id/monitors/heatmap?monitorId=N[&days=365][&tzOffset=minutes-east-of-UTC]
 * One row per local day that had runs: { date: 'YYYY-MM-DD', ok, error, avgMs }.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const projectId = parseInt(req.query.id, 10);
  const monitorId = parseInt(req.query.monitorId, 10);
  if (isNaN(projectId) || isNaN(monitorId)) return res.status(400).json({ error: 'Bad project or monitor id' });
  const days = Math.min(400, Math.max(1, parseInt(req.query.days, 10) || 365));
  const tzOffset = Math.min(840, Math.max(-720, parseInt(req.query.tzOffset, 10) || 0));

  try {
    const monitor = await prisma.cronMonitor.findFirst({
      where: { id: monitorId, projectId, project: { users: { some: { id: user.userId } } } },
      select: { id: true }
    });
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

    const since = new Date(Date.now() - (days + 1) * 86400000);
    const rows = await prisma.$queryRaw`
      SELECT to_char("createdAt" + (${tzOffset}::int * interval '1 minute'), 'YYYY-MM-DD') AS date,
             COUNT(*) FILTER (WHERE status = 'ok')::int AS ok,
             COUNT(*) FILTER (WHERE status = 'error')::int AS error,
             ROUND(AVG("durationMs") FILTER (WHERE status = 'ok'))::int AS "avgMs"
      FROM "MonitorCheckIn"
      WHERE "monitorId" = ${monitorId} AND "createdAt" >= ${since} AND status IN ('ok', 'error')
      GROUP BY 1
      ORDER BY 1`;
    return res.status(200).json({ success: true, days: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
