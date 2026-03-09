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
    const { projectId } = req.query;

    if (!projectId || projectId === '[object Object]') {
      return res.status(400).json({ error: 'Valid projectId is required' });
    }

    const id = parseInt(projectId);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid projectId format' });
    }

    // Fetch all transaction events for this project
    const transactions = await prisma.event.findMany({
      where: {
        projectId: id,
        eventType: 'TRANSACTION'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to last 100 transactions
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        transactions: [],
        analytics: null
      });
    }

    // Analyze transaction data
    const analytics = analyzeTransactions(transactions);

    res.status(200).json({
      transactions,
      analytics
    });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function analyzeTransactions(transactions) {
  const durations = [];
  const memoryTimeline = [];
  const cpuTimeline = [];
  const eventLoopTimeline = [];
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

  return {
    totalTransactions: transactions.length,
    avgDuration: durations.length > 0 ? totalDuration / durations.length : 0,
    avgMemoryHeap: memoryTimeline.length > 0 ? totalMemoryHeap / memoryTimeline.length : 0,
    avgMemoryRSS: memoryTimeline.length > 0 ? totalMemoryRSS / memoryTimeline.length : 0,
    avgCpu: cpuCount > 0 ? totalCpu / cpuCount : 0,
    avgEventLoopLag: eventLoopCount > 0 ? eventLoopTimeline.reduce((a, b) => a + b, 0) / eventLoopCount : 0,
    transactionDurations: durations,
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
    }
  };
}

