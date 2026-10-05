import prisma from '@/lib/prisma';
import { parse } from 'cookie';
import { loadMonitorStats } from '@/lib/monitor-stats-load';
import { summarizeProjectStats, RANGES } from '@/lib/monitor-stats';

function getUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/projects/:id/monitors/stats[?monitorId=N][&range=24h|7d|30d|90d]
 * Uptime (24h/7d/30d), latency, streaks, incidents and a bucketed series for the range
 * (hourly for 24h, 6-hourly for 7d, daily for 30d and 90d).
 * With monitorId: that monitor only. Without: every monitor plus a project rollup.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const projectId = parseInt(req.query.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Bad project id' });

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { users: { select: { id: true } } } });
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (!project.users.some((u) => u.id === user.userId)) return res.status(403).json({ error: 'Forbidden' });

    const where = { projectId };
    if (req.query.monitorId !== undefined) {
      const mid = parseInt(req.query.monitorId, 10);
      if (isNaN(mid)) return res.status(400).json({ error: 'Bad monitorId' });
      where.id = mid;
    }
    const monitors = await prisma.cronMonitor.findMany({
      where,
      select: { id: true, slug: true, name: true, status: true, environment: true },
      orderBy: { slug: 'asc' }
    });
    if (req.query.monitorId !== undefined && !monitors.length) return res.status(404).json({ error: 'Monitor not found' });

    const statsById = await loadMonitorStats(monitors.map((m) => m.id), new Date(), RANGES[req.query.range] ? req.query.range : '30d');
    const list = monitors.map((m) => ({ ...m, ...statsById.get(m.id) }));
    return res.status(200).json({
      success: true,
      monitors: list,
      summary: req.query.monitorId === undefined ? summarizeProjectStats(list) : undefined
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
