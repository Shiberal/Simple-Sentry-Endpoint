import prisma from '@/lib/prisma';
import { getSessionUser, visibleMonitorsWhere } from '@/lib/monitor-scope';
import { loadMonitorViews, loadSchedulerInfo } from '@/lib/monitor-view';

/** GET /api/monitors[?range=24h|7d|30d|90d] - monitors across every project the user belongs to, plus their standalone ones. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const projects = await prisma.project.findMany({
      where: { users: { some: { id: user.userId } } },
      select: { id: true, name: true, key: true }
    });
    const now = new Date();
    const { monitors, summary } = await loadMonitorViews(visibleMonitorsWhere(user.userId), { range: req.query.range, now });
    const scheduler = await loadSchedulerInfo(monitors, now);
    return res.status(200).json({ success: true, projects, monitors, summary, scheduler });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
