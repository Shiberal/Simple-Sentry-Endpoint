import prisma from '@/lib/prisma';
import { extractDuration } from '@/lib/sentry-transaction';
import { parse } from 'cookie';

const WINDOW_HOURS = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30
};

function getUserFromCookie(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const session = cookies.session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

function getStartDate(windowKey) {
  const hours = WINDOW_HOURS[windowKey] || WINDOW_HOURS['24h'];
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);
  return startDate;
}

function percentile(values, p) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createBucket(project) {
  return {
    id: project.id,
    name: project.name,
    key: project.key,
    createdAt: project.createdAt,
    activeMonitorCount: 0,
    transactions: [],
    checkIns: [],
    latestCheckIn: null,
    activeIssues: 0,
    activeOccurrences: 0,
    recentIssues: 0,
    recentErrorEvents: 0
  };
}

function summarizeProject(bucket) {
  const durationsMs = bucket.transactions
    .map((event) => extractDuration(event) * 1000)
    .filter((duration) => Number.isFinite(duration) && duration > 0);

  const successfulCheckIns = bucket.checkIns.filter((checkIn) => checkIn.status === 'ok').length;
  const failedCheckIns = bucket.checkIns.filter((checkIn) => checkIn.status !== 'ok').length;
  const pingDurations = bucket.checkIns
    .map((checkIn) => checkIn.durationMs)
    .filter((duration) => Number.isFinite(duration) && duration >= 0);

  const uptimePercent = bucket.checkIns.length
    ? (successfulCheckIns / bucket.checkIns.length) * 100
    : null;

  let status = 'healthy';
  const p95ResponseMs = percentile(durationsMs, 95);

  if (failedCheckIns > 0 || bucket.activeIssues >= 10 || bucket.recentErrorEvents >= 25) {
    status = 'critical';
  } else if (
    bucket.activeIssues > 0 ||
    bucket.recentErrorEvents > 0 ||
    p95ResponseMs > 1000 ||
    (bucket.activeMonitorCount > 0 && bucket.checkIns.length === 0)
  ) {
    status = 'warning';
  }

  return {
    id: bucket.id,
    name: bucket.name,
    key: bucket.key,
    createdAt: bucket.createdAt,
    status,
    response: {
      transactionCount: bucket.transactions.length,
      measuredTransactionCount: durationsMs.length,
      avgMs: average(durationsMs),
      p95Ms: p95ResponseMs
    },
    ping: {
      activeMonitorCount: bucket.activeMonitorCount,
      checkInCount: bucket.checkIns.length,
      successfulCheckIns,
      failedCheckIns,
      uptimePercent,
      avgDurationMs: average(pingDurations),
      latestStatus: bucket.latestCheckIn?.status || null,
      latestAt: bucket.latestCheckIn?.createdAt || null
    },
    errors: {
      activeIssues: bucket.activeIssues,
      activeOccurrences: bucket.activeOccurrences,
      recentIssues: bucket.recentIssues,
      recentErrorEvents: bucket.recentErrorEvents
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const user = getUserFromCookie(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    const requestedWindow = typeof req.query.window === 'string' ? req.query.window : '24h';
    const windowKey = WINDOW_HOURS[requestedWindow] ? requestedWindow : '24h';
    const startDate = getStartDate(windowKey);

    const projects = await prisma.project.findMany({
      where: {
        users: {
          some: {
            id: user.userId
          }
        }
      },
      select: {
        id: true,
        name: true,
        key: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!projects.length) {
      return res.status(200).json({
        success: true,
        window: windowKey,
        generatedAt: new Date().toISOString(),
        projects: []
      });
    }

    const projectIds = projects.map((project) => project.id);
    const buckets = new Map(projects.map((project) => [project.id, createBucket(project)]));

    const [
      transactions,
      monitors,
      checkIns,
      activeIssueGroups,
      recentIssueGroups,
      recentErrorEventGroups
    ] = await Promise.all([
      prisma.event.findMany({
        where: {
          projectId: { in: projectIds },
          eventType: 'TRANSACTION',
          createdAt: { gte: startDate }
        },
        select: {
          id: true,
          projectId: true,
          data: true
        }
      }),
      prisma.cronMonitor.findMany({
        where: {
          projectId: { in: projectIds },
          status: { not: 'disabled' }
        },
        select: {
          id: true,
          projectId: true
        }
      }),
      prisma.monitorCheckIn.findMany({
        where: {
          createdAt: { gte: startDate },
          monitor: {
            projectId: { in: projectIds }
          }
        },
        select: {
          id: true,
          status: true,
          durationMs: true,
          createdAt: true,
          monitor: {
            select: {
              projectId: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.issue.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          status: {
            notIn: ['RESOLVED', 'IGNORED']
          }
        },
        _count: {
          id: true
        },
        _sum: {
          count: true
        }
      }),
      prisma.issue.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),
      prisma.event.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          eventType: { in: ['ERROR', 'CSP', 'MINIDUMP', 'MESSAGE'] },
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      })
    ]);

    transactions.forEach((transaction) => {
      buckets.get(transaction.projectId)?.transactions.push(transaction);
    });

    monitors.forEach((monitor) => {
      const bucket = buckets.get(monitor.projectId);
      if (bucket) bucket.activeMonitorCount += 1;
    });

    checkIns.forEach((checkIn) => {
      const projectId = checkIn.monitor.projectId;
      const bucket = buckets.get(projectId);
      if (!bucket) return;

      bucket.checkIns.push(checkIn);
      if (!bucket.latestCheckIn || checkIn.createdAt > bucket.latestCheckIn.createdAt) {
        bucket.latestCheckIn = checkIn;
      }
    });

    activeIssueGroups.forEach((group) => {
      const bucket = buckets.get(group.projectId);
      if (!bucket) return;

      bucket.activeIssues = group._count.id;
      bucket.activeOccurrences = group._sum.count || 0;
    });

    recentIssueGroups.forEach((group) => {
      const bucket = buckets.get(group.projectId);
      if (bucket) bucket.recentIssues = group._count.id;
    });

    recentErrorEventGroups.forEach((group) => {
      const bucket = buckets.get(group.projectId);
      if (bucket) bucket.recentErrorEvents = group._count.id;
    });

    const summaries = Array.from(buckets.values()).map(summarizeProject);

    return res.status(200).json({
      success: true,
      window: windowKey,
      generatedAt: new Date().toISOString(),
      projects: summaries
    });
  } catch (error) {
    console.error('Error fetching projects summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch projects summary',
      message: error.message
    });
  }
}
