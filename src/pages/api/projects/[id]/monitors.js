import prisma from '@/lib/prisma';
import { parsePingUrlsInput, sanitizePingUrls } from '@/lib/monitor-http-ping';
import { resolveMonitorScope } from '@/lib/monitor-scope';
import { loadMonitorViews, loadSchedulerInfo } from '@/lib/monitor-view';
import { parseAlertFields } from '@/lib/monitor-alerts';

function validSlug(slug) {
  return typeof slug === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(slug.trim());
}

export default async function handler(req, res) {
  const scope = await resolveMonitorScope(req, req.query.id);
  if (scope.error) return res.status(scope.status).json({ error: scope.error });

  if (req.method === 'GET') {
    try {
      const now = new Date();
      const { monitors: enriched, summary } = await loadMonitorViews(scope.where, { range: req.query.range, now });
      const scheduler = await loadSchedulerInfo(enriched, now);
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
    // Without a project there is no DSN, so SDK check-ins cannot reach the monitor: it has to be pinged
    if (scope.projectId == null && !parsedUrls.length) {
      return res.status(400).json({ error: 'Standalone monitors need at least one ping URL' });
    }
    const alerts = parseAlertFields(req.body);
    if (alerts.error) return res.status(400).json({ error: alerts.error });

    try {
      const monitor = await prisma.cronMonitor.create({
        data: {
          ...alerts.data,
          ...scope.create,
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
      where: { id: mid, ...scope.where }
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

    const alerts = parseAlertFields(req.body);
    if (alerts.error) return res.status(400).json({ error: alerts.error });
    Object.assign(data, alerts.data);

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
      where: { id: mid, ...scope.where }
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
