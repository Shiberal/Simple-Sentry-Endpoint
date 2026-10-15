import prisma from '@/lib/prisma';
import { resolveMonitorScope } from '@/lib/monitor-scope';

/**
 * GET /api/projects/:id/monitors/checkins?monitorId=N[&status=ok|error|in_progress][&days=N][&from=ISO][&to=ISO][&before=<id>][&limit=N]
 * Newest-first check-in history for one monitor, paged by id (pass the last id as `before`).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const scope = await resolveMonitorScope(req, req.query.id);
  if (scope.error) return res.status(scope.status).json({ error: scope.error });
  const monitorId = parseInt(req.query.monitorId, 10);
  if (isNaN(monitorId)) return res.status(400).json({ error: 'Bad monitor id' });

  try {
    const monitor = await prisma.cronMonitor.findFirst({ where: { id: monitorId, ...scope.where }, select: { id: true } });
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const where = { monitorId };
    if (['ok', 'error', 'in_progress'].includes(req.query.status)) where.status = req.query.status;
    const days = parseInt(req.query.days, 10);
    if (days > 0) where.createdAt = { gte: new Date(Date.now() - days * 86400000) };
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if (from && !isNaN(from)) where.createdAt = { ...(where.createdAt || {}), gte: from };
    if (to && !isNaN(to)) where.createdAt = { ...(where.createdAt || {}), lte: to };
    const before = parseInt(req.query.before, 10);
    if (!isNaN(before)) where.id = { lt: before };

    const rows = await prisma.monitorCheckIn.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: { id: true, status: true, durationMs: true, environment: true, data: true, createdAt: true }
    });
    const page = rows.slice(0, limit).map(({ data, ...c }) => ({
      ...c,
      source: data?.source || 'sdk',
      results: data?.results || null
    }));
    return res.status(200).json({ success: true, checkIns: page, nextBefore: rows.length > limit ? page[page.length - 1].id : null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
