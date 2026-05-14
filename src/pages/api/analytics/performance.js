import prisma from '@/lib/prisma';
import {
  extractDuration,
  extractMeasurements,
  extractMemoryMetrics,
  extractCpuUsage,
  extractEventLoopLag,
  extractSpans,
  extractTransactionInfo
} from '@/lib/sentry-transaction';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, pageUrl } = req.query;

    if (!projectId || projectId === '[object Object]') {
      return res.status(400).json({ error: 'Valid projectId is required' });
    }

    const id = parseInt(projectId);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid projectId format' });
    }

    const whereEvt = {
      projectId: id,
      eventType: 'TRANSACTION'
    };

    if (pageUrl && String(pageUrl).trim()) {
      whereEvt.promotedPageUrl = {
        contains: String(pageUrl),
        mode: 'insensitive'
      };
    }

    const [transactions, monitorCheckIns] = await Promise.all([
      prisma.event.findMany({
        where: whereEvt,
        orderBy: {
          createdAt: 'desc'
        },
        take: 100 // Limit to last 100 transactions
      }),
      prisma.monitorCheckIn.findMany({
        where: {
          monitor: {
            projectId: id
          }
        },
        select: {
          id: true,
          status: true,
          environment: true,
          durationMs: true,
          createdAt: true,
          data: true,
          monitor: {
            select: {
              slug: true,
              name: true,
              environment: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      })
    ]);

    if (transactions.length === 0 && monitorCheckIns.length === 0) {
      return res.status(200).json({
        transactions: [],
        monitorCheckIns: [],
        analytics: null
      });
    }

    const analytics = analyzePerformance(transactions, monitorCheckIns);

    res.status(200).json({
      transactions,
      monitorCheckIns,
      analytics
    });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values, p) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function analyzePerformance(transactions, monitorCheckIns) {
  const durations = [];
  const memoryTimeline = [];
  const cpuTimeline = [];
  const eventLoopTimeline = [];
  const transactionNames = [];
  const webVitals = {
    fcp: [],
    lcp: [],
    fid: [],
    cls: [],
    ttfb: []
  };
  
  let totalDuration = 0;
  let totalMemoryHeap = 0;
  let totalMemoryRSS = 0;
  let totalCpu = 0;
  let cpuCount = 0;
  let eventLoopCount = 0;

  transactions.forEach(transaction => {
    // Extract transaction name
    const info = extractTransactionInfo(transaction);
    transactionNames.push(info.name || 'Unnamed');

    // Extract duration using Sentry parser
    const duration = extractDuration(transaction);
    if (duration > 0) {
      durations.push(duration);
      totalDuration += duration;
    }

    // Extract memory metrics using Sentry parser
    const memory = extractMemoryMetrics(transaction);
    if (memory.heapUsed || memory.heapTotal || memory.rss) {
      memoryTimeline.push({
        heapUsed: memory.heapUsed || 0,
        heapTotal: memory.heapTotal || 0,
        rss: memory.rss || 0
      });
      if (memory.heapUsed) {
        totalMemoryHeap += memory.heapUsed;
      }
      if (memory.rss) {
        totalMemoryRSS += memory.rss;
      }
    }

    // Extract CPU usage using Sentry parser
    const cpu = extractCpuUsage(transaction);
    if (cpu !== null) {
      cpuTimeline.push(cpu);
      totalCpu += cpu;
      cpuCount++;
    }

    // Extract event loop lag using Sentry parser
    const eventLoopLag = extractEventLoopLag(transaction);
    if (eventLoopLag !== null) {
      eventLoopTimeline.push(eventLoopLag);
      eventLoopCount++;
    }

    // Extract Web Vitals measurements
    const measurements = extractMeasurements(transaction);
    if (measurements.fcp !== null) webVitals.fcp.push(measurements.fcp);
    if (measurements.lcp !== null) webVitals.lcp.push(measurements.lcp);
    if (measurements.fid !== null) webVitals.fid.push(measurements.fid);
    if (measurements.cls !== null) webVitals.cls.push(measurements.cls);
    if (measurements.ttfb !== null) webVitals.ttfb.push(measurements.ttfb);
  });

  // Calculate Web Vitals averages
  const calculateAvg = (arr) => arr.length > 0 
    ? arr.reduce((a, b) => a + b, 0) / arr.length 
    : null;

  const pingDurations = monitorCheckIns
    .map((checkIn) => Number(checkIn.durationMs))
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  const successfulCheckIns = monitorCheckIns.filter((checkIn) => checkIn.status === 'ok').length;
  const failedCheckIns = monitorCheckIns.filter((checkIn) => checkIn.status !== 'ok').length;

  return {
    totalTransactions: transactions.length,
    avgDuration: durations.length > 0 ? totalDuration / durations.length : 0,
    avgMemoryHeap: memoryTimeline.length > 0 ? totalMemoryHeap / memoryTimeline.length : 0,
    avgMemoryRSS: memoryTimeline.length > 0 ? totalMemoryRSS / memoryTimeline.length : 0,
    avgCpu: cpuCount > 0 ? totalCpu / cpuCount : 0,
    avgEventLoopLag: eventLoopCount > 0 ? eventLoopTimeline.reduce((a, b) => a + b, 0) / eventLoopCount : 0,
    transactionDurations: durations,
    transactionNames,
    memoryTimeline,
    cpuTimeline,
    eventLoopTimeline,
    // Web Vitals
    webVitals: {
      avgFcp: calculateAvg(webVitals.fcp),
      avgLcp: calculateAvg(webVitals.lcp),
      avgFid: calculateAvg(webVitals.fid),
      avgCls: calculateAvg(webVitals.cls),
      avgTtfb: calculateAvg(webVitals.ttfb),
      fcp: webVitals.fcp,
      lcp: webVitals.lcp,
      fid: webVitals.fid,
      cls: webVitals.cls,
      ttfb: webVitals.ttfb
    },
    ping: {
      totalCheckIns: monitorCheckIns.length,
      successfulCheckIns,
      failedCheckIns,
      uptimePercent: monitorCheckIns.length > 0 ? (successfulCheckIns / monitorCheckIns.length) * 100 : null,
      avgDurationMs: average(pingDurations),
      minDurationMs: pingDurations.length > 0 ? Math.min(...pingDurations) : 0,
      maxDurationMs: pingDurations.length > 0 ? Math.max(...pingDurations) : 0,
      p95DurationMs: percentile(pingDurations, 95),
      durationsMs: pingDurations,
      labels: monitorCheckIns
        .filter((checkIn) => Number.isFinite(Number(checkIn.durationMs)) && Number(checkIn.durationMs) >= 0)
        .map((checkIn) => checkIn.monitor?.slug || 'monitor')
    }
  };
}

