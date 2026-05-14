import prisma from '@/lib/prisma';
import { parse } from 'cookie';
import { runMonitorHttpPings } from '@/lib/monitor-ping-runner';

function getUser(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const projectId = parseInt(req.query.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Bad project id' });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { users: { select: { id: true } } }
  });

  if (!project) return res.status(404).json({ error: 'Not found' });
  if (!project.users.some((u) => u.id === user.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body || {};
  const mid =
    body.monitorId != null ? parseInt(String(body.monitorId), 10) : NaN;

  try {
    const summaries = await runMonitorHttpPings(
      Number.isFinite(mid) && !isNaN(mid)
        ? { monitorId: mid, projectId, force: true }
        : { projectId, force: true }
    );

    return res.status(200).json({
      success: true,
      ran: summaries.length,
      summaries
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Ping run failed' });
  }
}
