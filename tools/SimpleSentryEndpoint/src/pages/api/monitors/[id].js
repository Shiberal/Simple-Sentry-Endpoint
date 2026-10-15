import prisma from '@/lib/prisma';
import { getSessionUser, visibleMonitorsWhere } from '@/lib/monitor-scope';
import { loadMonitorViews } from '@/lib/monitor-view';

/**
 * GET /api/monitors/:id[?range=24h|7d|30d|90d]
 * One monitor with health, config (incl. alert settings), stats, charts series and incidents.
 * Edits go through PATCH/DELETE /api/projects/:projectId/monitors.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const id = parseInt(req.query.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Bad monitor id' });
  try {
    const row = await prisma.cronMonitor.findFirst({
      where: { id, ...visibleMonitorsWhere(user.userId) },
      select: { id: true }
    });
    if (!row) return res.status(404).json({ error: 'Monitor not found' });
    const { monitors } = await loadMonitorViews({ id }, { range: req.query.range });
    return res.status(200).json({ success: true, monitor: monitors[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
