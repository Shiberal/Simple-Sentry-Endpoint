import prisma from '@/lib/prisma';
import { parse } from 'cookie';
import { loadMonitorViews, loadSchedulerInfo } from '@/lib/monitor-view';

function getUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

/** GET /api/monitors[?range=24h|7d|30d|90d] - monitors across every project the user belongs to. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const projects = await prisma.project.findMany({
      where: { users: { some: { id: user.userId } } },
      select: { id: true, name: true, key: true }
    });
    const now = new Date();
    const { monitors, summary } = await loadMonitorViews({ projectId: { in: projects.map((p) => p.id) } }, { range: req.query.range, now });
    const scheduler = await loadSchedulerInfo(monitors, now);
    return res.status(200).json({ success: true, projects, monitors, summary, scheduler });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
