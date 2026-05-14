import prisma from '@/lib/prisma';
import { parsePingUrlsInput, sanitizePingUrls } from '@/lib/monitor-http-ping';
import { parse } from 'cookie';

function getUser(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

function validSlug(slug) {
  return typeof slug === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(slug.trim());
}

async function loadProjectAccess(req, projectId) {
  const user = getUser(req);
  if (!user) return { error: 'unauthorized', status: 401, user: null, project: null };
  if (isNaN(projectId)) return { error: 'bad_project', status: 400, user: null, project: null };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { users: { select: { id: true } } }
  });

  if (!project) return { error: 'not_found', status: 404, user: null, project: null };
  if (!project.users.some((u) => u.id === user.userId)) {
    return { error: 'forbidden', status: 403, user: null, project: null };
  }

  return { error: null, user, project };
}

export default async function handler(req, res) {
  const projectId = parseInt(req.query.id, 10);
  const access = await loadProjectAccess(req, projectId);

  if (access.error === 'unauthorized') {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (access.error === 'bad_project') {
    return res.status(400).json({ error: 'Bad project id' });
  }
  if (access.error === 'not_found') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (access.error === 'forbidden') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    try {
      const monitors = await prisma.cronMonitor.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        include: {
          checkIns: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });
      return res.status(200).json({ success: true, monitors });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { slug, name, schedule, environment, status, pingUrls: pingRaw, urls } =
      req.body || {};
    const s = typeof slug === 'string' ? slug.trim() : '';
    if (!validSlug(s)) {
      return res.status(400).json({
        error:
          'Invalid slug: use 1–128 chars of letters, numbers, hyphen, underscore (matches Sentry monitor_slug)'
      });
    }

    const parsedUrls = sanitizePingUrls(parsePingUrlsInput(pingRaw ?? urls));

    try {
      const monitor = await prisma.cronMonitor.create({
        data: {
          projectId,
          slug: s,
          name: name != null && String(name).trim() ? String(name).trim() : null,
          schedule:
            schedule != null && String(schedule).trim() ? String(schedule).trim() : null,
          environment:
            environment != null && String(environment).trim()
              ? String(environment).trim()
              : null,
          status: status != null && String(status).trim() ? String(status).trim() : 'active',
          pingUrls: parsedUrls
        }
      });
      return res.status(201).json({ success: true, monitor });
    } catch (e) {
      if (e.code === 'P2002') {
        return res.status(409).json({ error: 'A monitor with this slug already exists' });
      }
      console.error(e);
      return res.status(500).json({ error: e.message || 'Create failed' });
    }
  }

  if (req.method === 'PATCH') {
    const { monitorId, name, schedule, environment, status, pingUrls: pingRaw, urls } =
      req.body || {};
    const mid = parseInt(monitorId, 10);
    if (isNaN(mid)) {
      return res.status(400).json({ error: 'monitorId required' });
    }

    const existing = await prisma.cronMonitor.findFirst({
      where: { id: mid, projectId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name?.trim?.() ? name.trim() : null;
    if (schedule !== undefined) {
      data.schedule = schedule?.trim?.() ? schedule.trim() : null;
    }
    if (environment !== undefined) {
      data.environment = environment?.trim?.() ? environment.trim() : null;
    }
    if (status !== undefined) {
      data.status = status?.trim?.() ? status.trim() : existing.status;
    }
    if (pingRaw !== undefined || urls !== undefined) {
      data.pingUrls = sanitizePingUrls(parsePingUrlsInput(pingRaw ?? urls));
    }

    try {
      const monitor = await prisma.cronMonitor.update({
        where: { id: mid },
        data
      });
      return res.status(200).json({ success: true, monitor });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    const midRaw = req.query.monitorId ?? req.body?.monitorId;
    const mid = parseInt(midRaw, 10);
    if (isNaN(mid)) {
      return res.status(400).json({ error: 'monitorId query required' });
    }

    const existing = await prisma.cronMonitor.findFirst({
      where: { id: mid, projectId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    await prisma.cronMonitor.delete({ where: { id: mid } });
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return res.status(405).end();
}
