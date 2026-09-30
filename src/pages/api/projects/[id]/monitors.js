import prisma from '@/lib/prisma';
import { parsePingUrlsInput, sanitizePingUrls } from '@/lib/monitor-http-ping';
import { parse } from 'cookie';
import { computeMonitorHealth, describeSchedule, healthSeverity } from '@/lib/monitor-health';
import { DEFAULT_MONITOR_PING_INTERVAL_MS } from '@/lib/monitor-schedule';

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
        include: {
          checkIns: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: { id: true, status: true, durationMs: true, environment: true, data: true, createdAt: true }
          }
        }
      });

      const now = new Date();
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const counts = monitors.length
        ? await prisma.monitorCheckIn.groupBy({
            by: ['monitorId', 'status'],
            where: { monitorId: { in: monitors.map((m) => m.id) }, createdAt: { gte: since } },
            _count: { _all: true }
          })
        : [];

      const fallbackMs = parseInt(process.env.MONITOR_HTTP_PING_FALLBACK_INTERVAL_MS || '', 10);
      const fallbackIntervalMs = Number.isFinite(fallbackMs) && fallbackMs >= 60000 ? fallbackMs : DEFAULT_MONITOR_PING_INTERVAL_MS;

      const enriched = monitors.map((m) => {
        const recent = m.checkIns; // newest first
        const latest = recent[0] || null;
        const lastFinished = recent.find((c) => c.status !== 'in_progress') || null;
        const health = computeMonitorHealth({ monitor: m, latest, lastFinished, now, fallbackIntervalMs });

        const c24 = counts.filter((c) => c.monitorId === m.id);
        const ok24h = c24.filter((c) => c.status === 'ok').reduce((n, c) => n + c._count._all, 0);
        const error24h = c24.filter((c) => c.status === 'error').reduce((n, c) => n + c._count._all, 0);
        const finished24h = ok24h + error24h;
        const durations = recent.filter((c) => c.status !== 'in_progress' && c.durationMs != null).map((c) => c.durationMs);

        return {
          ...m,
          checkIns: recent.slice(0, 8).map((c) => ({ ...c, source: c.data?.source || 'sdk', results: c.data?.results || null, data: undefined })),
          history: [...recent].reverse().map((c) => ({ status: c.status, durationMs: c.durationMs, at: c.createdAt })),
          health: health.health,
          healthReason: health.reason,
          scheduleText: describeSchedule(m.schedule),
          nextRunAt: health.nextRunAt,
          lastExpectedAt: health.lastExpectedAt,
          lastRunAt: lastFinished?.createdAt || m.lastCheckInAt || null,
          lastDurationMs: lastFinished?.durationMs ?? null,
          stats: {
            ok24h,
            error24h,
            uptime24h: finished24h ? Math.round((ok24h / finished24h) * 1000) / 10 : null,
            avgDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
          }
        };
      });

      enriched.sort((a, b) => healthSeverity(a.health) - healthSeverity(b.health) || a.slug.localeCompare(b.slug));

      const summary = { total: enriched.length, ok: 0, failing: 0, missed: 0, running: 0, paused: 0, pending: 0, unknown: 0 };
      enriched.forEach((m) => { summary[m.health] += 1; });
      const finished24 = enriched.reduce((n, m) => n + m.stats.ok24h + m.stats.error24h, 0);
      const ok24 = enriched.reduce((n, m) => n + m.stats.ok24h, 0);
      summary.uptime24h = finished24 ? Math.round((ok24 / finished24) * 1000) / 10 : null;
      summary.runs24h = finished24;

      // Scheduled pings only run if something drives them; flag when they are overdue
      const overduePings = enriched.filter((m) => m.pingUrls.length > 0 && m.health === 'missed').length;
      const scheduler = {
        inProcessPinger: process.env.ENABLE_MONITOR_HTTP_PINGER === 'true' || process.env.ENABLE_MONITOR_HTTP_PINGER === '1',
        cronEndpointConfigured: !!String(process.env.MONITOR_CRON_SECRET || '').trim(),
        overduePingMonitors: overduePings,
        warning: overduePings > 0
      };

      return res.status(200).json({ success: true, monitors: enriched, summary, scheduler });
    } catch (e) {
      console.error(e);
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
          status: status === 'paused' ? 'paused' : 'active',
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
      if (!['active', 'paused'].includes(status)) {
        return res.status(400).json({ error: "status must be 'active' or 'paused'" });
      }
      data.status = status;
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
