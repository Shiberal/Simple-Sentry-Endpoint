import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/admin';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'bigint') return Number(v);
  return Number(v) || 0;
}

function buildAlerts({ databaseBytes, eventsLastHour, eventsLast24h, eventsPrev24h, unresolvedIssues, eventTableShare, oldestEventAgeDays }) {
  const alerts = [];

  if (databaseBytes >= 8 * GB) {
    alerts.push({
      level: 'critical',
      code: 'db_size',
      message: `Database is ${formatBytes(databaseBytes)} — storage pressure is high. Clean up old events or grow the disk soon.`,
    });
  } else if (databaseBytes >= 2 * GB) {
    alerts.push({
      level: 'warning',
      code: 'db_size',
      message: `Database is ${formatBytes(databaseBytes)}. Plan retention cleanup before this grows further.`,
    });
  }

  if (eventTableShare >= 0.85) {
    alerts.push({
      level: 'warning',
      code: 'event_table_share',
      message: `Event tables use ${Math.round(eventTableShare * 100)}% of database size — retention is the main lever.`,
    });
  }

  if (eventsLastHour >= 2000) {
    alerts.push({
      level: 'critical',
      code: 'ingest_spike',
      message: `${eventsLastHour.toLocaleString()} events in the last hour — ingest spike may overwhelm storage and UI.`,
    });
  } else if (eventsLastHour >= 500) {
    alerts.push({
      level: 'warning',
      code: 'ingest_spike',
      message: `${eventsLastHour.toLocaleString()} events in the last hour — elevated ingest rate.`,
    });
  }

  if (eventsPrev24h > 50 && eventsLast24h >= eventsPrev24h * 2) {
    const factor = (eventsLast24h / eventsPrev24h).toFixed(1);
    alerts.push({
      level: 'warning',
      code: 'ingest_growth',
      message: `Events last 24h are ${factor}× the previous day (${eventsLast24h.toLocaleString()} vs ${eventsPrev24h.toLocaleString()}).`,
    });
  }

  if (unresolvedIssues >= 1000) {
    alerts.push({
      level: 'critical',
      code: 'open_issues',
      message: `${unresolvedIssues.toLocaleString()} unresolved issues — triage backlog is large.`,
    });
  } else if (unresolvedIssues >= 250) {
    alerts.push({
      level: 'warning',
      code: 'open_issues',
      message: `${unresolvedIssues.toLocaleString()} unresolved issues — backlog is growing.`,
    });
  }

  if (oldestEventAgeDays != null && oldestEventAgeDays > 90) {
    alerts.push({
      level: 'info',
      code: 'retention',
      message: `Oldest event is ~${Math.round(oldestEventAgeDays)} days old. Consider running maintenance cleanup if disk is tight.`,
    });
  }

  return alerts;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(1)} KB`;
  if (n < GB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / GB).toFixed(2)} GB`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await checkAdminAuth(req);
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      error: error.message || 'Unauthorized',
    });
  }

  try {
    const now = new Date();
    const last1Hour = new Date(now.getTime() - 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prev24Hours = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const nonCheckIn = { eventType: { not: 'CHECK_IN' } };

    const safe = (promise, fallback) =>
      promise.catch((err) => {
        console.error('Admin stats partial query failed:', err);
        return fallback;
      });

    const [
      users,
      projects,
      events,
      issues,
      unresolvedIssues,
      regressedIssues,
      recentEvents,
      eventsLastHour,
      eventsPrev24h,
      recentIssues,
      eventsLast7d,
      checkInsLast24h,
      monitors,
      debugFiles,
      releases,
      workers,
      dbSizeRows,
      tableSizeRows,
      hourlyRows,
      byTypeRows,
      topProjectRows,
      eventSpanRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.event.count({ where: nonCheckIn }),
      prisma.issue.count(),
      prisma.issue.count({ where: { status: 'UNRESOLVED' } }),
      prisma.issue.count({ where: { regressedAt: { not: null } } }),
      prisma.event.count({
        where: { ...nonCheckIn, createdAt: { gte: last24Hours } },
      }),
      prisma.event.count({
        where: { ...nonCheckIn, createdAt: { gte: last1Hour } },
      }),
      prisma.event.count({
        where: {
          ...nonCheckIn,
          createdAt: { gte: prev24Hours, lt: last24Hours },
        },
      }),
      prisma.issue.count({
        where: { firstSeen: { gte: last24Hours } },
      }),
      prisma.event.count({
        where: { ...nonCheckIn, createdAt: { gte: last7Days } },
      }),
      prisma.monitorCheckIn.count({
        where: { createdAt: { gte: last24Hours } },
      }),
      prisma.cronMonitor.count(),
      prisma.debugFile.count(),
      prisma.release.count(),
      prisma.workerHeartbeat.findMany({
        orderBy: { lastTickAt: 'desc' },
        take: 20,
      }),
      safe(prisma.$queryRaw`SELECT pg_database_size(current_database())::bigint AS size`, [{ size: 0 }]),
      safe(
        prisma.$queryRaw`
          SELECT
            c.relname AS name,
            pg_total_relation_size(c.oid)::bigint AS total_bytes,
            pg_relation_size(c.oid)::bigint AS table_bytes,
            (pg_total_relation_size(c.oid) - pg_relation_size(c.oid))::bigint AS index_bytes
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'r'
          ORDER BY pg_total_relation_size(c.oid) DESC
        `,
        []
      ),
      safe(
        prisma.$queryRaw`
          SELECT date_trunc('hour', "createdAt") AS hour, COUNT(*)::int AS count
          FROM "Event"
          WHERE "createdAt" >= ${last24Hours}
            AND "eventType"::text <> 'CHECK_IN'
          GROUP BY 1
          ORDER BY 1
        `,
        []
      ),
      safe(
        prisma.$queryRaw`
          SELECT "eventType"::text AS type, COUNT(*)::int AS count
          FROM "Event"
          WHERE "createdAt" >= ${last24Hours}
          GROUP BY 1
          ORDER BY count DESC
        `,
        []
      ),
      safe(
        prisma.$queryRaw`
          SELECT p.id, p.name, COUNT(e.id)::int AS events
          FROM "Project" p
          LEFT JOIN "Event" e ON e."projectId" = p.id
            AND e."createdAt" >= ${last24Hours}
            AND e."eventType"::text <> 'CHECK_IN'
          GROUP BY p.id, p.name
          HAVING COUNT(e.id) > 0
          ORDER BY events DESC
          LIMIT 8
        `,
        []
      ),
      // Avoid ORDER BY createdAt ASC on the whole Event table (can be huge)
      safe(
        prisma.$queryRaw`
          SELECT MIN("createdAt") AS oldest, MAX("createdAt") AS newest
          FROM "Event"
          WHERE "eventType"::text <> 'CHECK_IN'
        `,
        [{ oldest: null, newest: null }]
      ),
    ]);

    const oldestEvent = eventSpanRows?.[0]?.oldest
      ? { createdAt: eventSpanRows[0].oldest }
      : null;
    const newestEvent = eventSpanRows?.[0]?.newest
      ? { createdAt: eventSpanRows[0].newest }
      : null;

    const databaseBytes = num(dbSizeRows?.[0]?.size);
    const tables = (tableSizeRows || []).map((row) => ({
      name: row.name,
      totalBytes: num(row.total_bytes),
      tableBytes: num(row.table_bytes),
      indexBytes: num(row.index_bytes),
    }));

    const eventTableBytes = tables
      .filter((t) => t.name === 'Event' || t.name.startsWith('Event_'))
      .reduce((sum, t) => sum + t.totalBytes, 0);
    const eventTableShare = databaseBytes > 0 ? eventTableBytes / databaseBytes : 0;

    // Fill missing hours so the chart is continuous (match by epoch hour)
    const hourlyMap = new Map();
    for (const row of hourlyRows || []) {
      const t = new Date(row.hour).getTime();
      const hourKey = Math.floor(t / (60 * 60 * 1000));
      hourlyMap.set(hourKey, num(row.count));
    }
    const hourly = [];
    const endHour = Math.floor(now.getTime() / (60 * 60 * 1000));
    for (let i = 23; i >= 0; i -= 1) {
      const hourKey = endHour - i;
      hourly.push({
        hour: new Date(hourKey * 60 * 60 * 1000).toISOString(),
        count: hourlyMap.get(hourKey) || 0,
      });
    }

    const byType = (byTypeRows || []).map((row) => ({
      type: row.type,
      count: num(row.count),
    }));

    const topProjects = (topProjectRows || []).map((row) => ({
      id: num(row.id),
      name: row.name,
      events: num(row.events),
    }));

    const oldestEventAgeDays = oldestEvent?.createdAt
      ? (now.getTime() - new Date(oldestEvent.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      : null;

    const mem = process.memoryUsage();
    const processInfo = {
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
    };

    const workerStatus = (workers || []).map((w) => ({
      id: w.id,
      kind: w.kind,
      lastTickAt: w.lastTickAt,
      startedAt: w.startedAt,
      intervalMs: w.intervalMs,
      ticks: w.ticks,
      lastError: w.lastError,
      stale: now.getTime() - new Date(w.lastTickAt).getTime() > Math.max(w.intervalMs * 3, 5 * 60 * 1000),
    }));

    const alerts = buildAlerts({
      databaseBytes,
      eventsLastHour,
      eventsLast24h: recentEvents,
      eventsPrev24h,
      unresolvedIssues,
      eventTableShare,
      oldestEventAgeDays,
    });

    res.status(200).json({
      success: true,
      stats: {
        users,
        projects,
        events,
        issues,
        recentEvents,
        recentIssues,
        unresolvedIssues,
        regressedIssues,
        eventsLastHour,
        eventsPrev24h,
        eventsLast7d,
        checkInsLast24h,
        monitors,
        debugFiles,
        releases,
      },
      storage: {
        databaseBytes,
        databaseLabel: formatBytes(databaseBytes),
        eventTableBytes,
        eventTableShare,
        tables,
      },
      ingest: {
        hourly,
        byType,
        topProjects,
        oldestEventAt: oldestEvent?.createdAt || null,
        newestEventAt: newestEvent?.createdAt || null,
      },
      process: processInfo,
      workers: workerStatus,
      alerts,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message,
    });
  }
}
