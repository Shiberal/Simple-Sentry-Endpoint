import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { parse } from 'cookie';

function getUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

const BUCKETS = [50, 100, 250, 500, 1000, 2500];

/**
 * GET /api/analytics/performance/overview?projectId=N&startDate=ISO&endDate=ISO[&pageUrl=][&origin=host]
 * Latency percentiles, per-endpoint stats, distribution and slowest requests, aggregated in SQL
 * over every transaction in the range (no row cap).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const projectId = parseInt(req.query.projectId, 10);
  const start = new Date(String(req.query.startDate || ''));
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();
  if (isNaN(projectId) || isNaN(start) || isNaN(end)) return res.status(400).json({ error: 'projectId and valid dates are required' });
  const pageUrl = String(req.query.pageUrl || '').trim();
  const origin = String(req.query.origin || '').trim().toLowerCase();

  try {
    const allowed = await prisma.project.findFirst({ where: { id: projectId, users: { some: { id: user.userId } } }, select: { id: true } });
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const urlFilter = pageUrl ? Prisma.sql`AND "promotedPageUrl" ILIKE ${`%${pageUrl}%`}` : Prisma.empty;
    const originFilter = origin
      ? Prisma.sql`AND ("promotedOrigin" = ${origin} OR ("promotedOrigin" IS NULL AND "promotedPageUrl" ILIKE ${`%://${origin}%`}))`
      : Prisma.empty;
    // One CTE shared by every query below; ms = duration in milliseconds
    const base = Prisma.sql`
      SELECT id, "createdAt", data->>'transaction' AS name,
             ((data->>'timestamp')::float8 - (data->>'start_timestamp')::float8) * 1000 AS ms,
             COALESCE(data->'contexts'->'trace'->>'status', data->>'status') NOT IN ('ok', 'cancelled') AS failed
      FROM "Event"
      WHERE "projectId" = ${projectId} AND "eventType" = 'TRANSACTION'
        AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND jsonb_typeof(data->'timestamp') = 'number' AND jsonb_typeof(data->'start_timestamp') = 'number'
        ${urlFilter} ${originFilter}`;
    const mid = new Date((start.getTime() + end.getTime()) / 2);

    const [totals, endpoints, hist, slowest] = await Promise.all([
      prisma.$queryRaw`
        WITH t AS (${base}), p AS (SELECT * FROM t WHERE ms > 0)
        SELECT COUNT(*)::int AS total, AVG(ms) AS avg,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) AS p50,
               percentile_cont(0.95) WITHIN GROUP (ORDER BY ms) AS p95,
               percentile_cont(0.99) WITHIN GROUP (ORDER BY ms) AS p99,
               COUNT(*) FILTER (WHERE failed)::int AS errors,
               MIN("createdAt") AS oldest, MAX("createdAt") AS newest,
               percentile_cont(0.95) WITHIN GROUP (ORDER BY ms) FILTER (WHERE "createdAt" < ${mid}) AS "earlyP95",
               percentile_cont(0.95) WITHIN GROUP (ORDER BY ms) FILTER (WHERE "createdAt" >= ${mid}) AS "lateP95",
               COUNT(*) FILTER (WHERE "createdAt" < ${mid})::int AS "earlyN",
               COUNT(*) FILTER (WHERE "createdAt" >= ${mid})::int AS "lateN"
        FROM p`,
      prisma.$queryRaw`
        WITH t AS (${base})
        SELECT COALESCE(name, 'Unnamed') AS name, COUNT(*)::int AS count, AVG(ms) AS avg,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) AS p50,
               percentile_cont(0.95) WITHIN GROUP (ORDER BY ms) AS p95,
               MAX(ms) AS max, COUNT(*) FILTER (WHERE failed)::int AS errors,
               SUM(ms) AS "totalMs", MAX("createdAt") AS "lastSeen"
        FROM t WHERE ms > 0
        GROUP BY 1 ORDER BY SUM(ms) DESC LIMIT 500`,
      prisma.$queryRaw`
        WITH t AS (${base})
        SELECT width_bucket(ms, ${BUCKETS}::float8[]) AS bucket, COUNT(*)::int AS count
        FROM t WHERE ms > 0 GROUP BY 1`,
      prisma.$queryRaw`
        WITH t AS (${base})
        SELECT id, COALESCE(name, 'Unnamed') AS name, ms, "createdAt" AS at, COALESCE(failed, false) AS failed
        FROM t WHERE ms > 0 ORDER BY ms DESC LIMIT 10`
    ]);

    const tot = totals[0];
    if (!tot || !tot.total) return res.status(200).json({ success: true, summary: null });
    const sumMs = endpoints.reduce((n, e) => n + Number(e.totalMs), 0);
    const spanMin = Math.max(1, (new Date(tot.newest) - new Date(tot.oldest)) / 60000);
    const early = Number(tot.earlyP95);
    const trendOk = tot.earlyN >= 5 && tot.lateN >= 5 && early > 0;
    const counts = new Map(hist.map((h) => [Number(h.bucket), h.count]));

    return res.status(200).json({
      success: true,
      summary: {
        total: tot.total,
        avg: Number(tot.avg),
        p50: Number(tot.p50),
        p95: Number(tot.p95),
        p99: Number(tot.p99),
        throughputPerMin: tot.total / spanMin,
        errors: tot.errors,
        errorRate: tot.errors / tot.total,
        p95Trend: trendOk ? (Number(tot.lateP95) - early) / early : null,
        endpoints: endpoints.map((e) => ({
          name: e.name,
          count: e.count,
          avg: Number(e.avg),
          p50: Number(e.p50),
          p95: Number(e.p95),
          max: Number(e.max),
          errors: e.errors,
          errorRate: e.errors / e.count,
          totalMs: Number(e.totalMs),
          share: Number(e.totalMs) / sumMs,
          lastSeen: new Date(e.lastSeen).getTime()
        })),
        // width_bucket over the thresholds gives 0 (below the first) .. N (at or above the last)
        histogram: [...BUCKETS, Infinity].map((upTo, i) => ({ upTo, count: counts.get(i) || 0 })),
        slowest: slowest.map((r) => ({ id: r.id, name: r.name, ms: Number(r.ms), at: new Date(r.at).getTime(), failed: !!r.failed }))
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
