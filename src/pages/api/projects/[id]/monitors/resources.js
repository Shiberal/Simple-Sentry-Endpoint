import prisma from '@/lib/prisma';
import { parse } from 'cookie';
import { downsample, generateReportToken } from '@/lib/monitor-resources';

function getUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

// GET ?monitorId=&hours=  -> CPU/RAM series + report token (project members only)
// POST { monitorId }      -> create or rotate the report token (the old one stops working)
export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const projectId = parseInt(req.query.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Bad project id' });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { users: { select: { id: true } } }
  });
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (!project.users.some((u) => u.id === user.userId)) return res.status(403).json({ error: 'Forbidden' });

  const monitorId = parseInt(req.query.monitorId ?? req.body?.monitorId, 10);
  if (isNaN(monitorId)) return res.status(400).json({ error: 'monitorId required' });
  const monitor = await prisma.cronMonitor.findFirst({ where: { id: monitorId, projectId } });
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

  if (req.method === 'GET') {
    const hours = Math.min(168, Math.max(1, parseInt(req.query.hours, 10) || 6));
    const rows = await prisma.monitorResourceSample.findMany({
      where: { monitorId, createdAt: { gte: new Date(Date.now() - hours * 3600 * 1000) } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, cpuPercent: true, memUsedBytes: true, memLimitBytes: true, cpuLimitCores: true }
    });
    const samples = downsample(rows);
    return res.status(200).json({
      success: true,
      hours,
      reportToken: monitor.reportToken,
      latest: rows.length ? rows[rows.length - 1] : null,
      samples
    });
  }

  if (req.method === 'POST') {
    const reportToken = generateReportToken();
    await prisma.cronMonitor.update({ where: { id: monitorId }, data: { reportToken } });
    return res.status(200).json({ success: true, reportToken });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end();
}
