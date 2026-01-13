import prisma from '@/lib/prisma';
import {
  extractDuration,
  extractMeasurements,
  extractMemoryMetrics,
  extractCpuUsage,
  extractEventLoopLag
} from '@/lib/sentry-transaction';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, interval = 'day', startDate, endDate } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Calculate date range (default to last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Validate interval
    const validInterval = interval === 'hour' ? 'hour' : 'day';

    // Fetch all transaction events for this project within the date range
    const transactions = await prisma.event.findMany({
      where: {
        projectId: parseInt(projectId),
        eventType: 'TRANSACTION',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        series: [],
        interval: validInterval,
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });
    }

    // Group transactions by time interval and calculate metrics
    const series = groupAndAggregateTransactions(transactions, validInterval);

    res.status(200).json({
      series,
      interval: validInterval,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
  } catch (error) {
    console.error('Error fetching performance time series:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function groupAndAggregateTransactions(transactions, interval) {
  const grouped = new Map();

  transactions.forEach(transaction => {
    const timestamp = new Date(transaction.createdAt);
    const intervalKey = truncateToInterval(timestamp, interval);
    
    if (!grouped.has(intervalKey)) {
      grouped.set(intervalKey, []);
    }
    grouped.get(intervalKey).push(transaction);
  });

  // Convert to array and calculate metrics for each interval
  const series = Array.from(grouped.entries())
    .map(([intervalKey, intervalTransactions]) => {
      const metrics = calculateIntervalMetrics(intervalTransactions);
      return {
        timestamp: intervalKey,
        interval,
        metrics,
        count: intervalTransactions.length
      };
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return series;
}

function truncateToInterval(date, interval) {
  const d = new Date(date);
  
  if (interval === 'hour') {
    // Truncate to hour
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
  } else {
    // Truncate to day
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
  }
  
  return d.toISOString();
}

function calculateIntervalMetrics(transactions) {
  const durations = [];
  const memoryHeapUsed = [];
  const memoryHeapTotal = [];
  const memoryRSS = [];
  const cpuValues = [];
  const eventLoopLagValues = [];
  const webVitals = {
    fcp: [],
    lcp: [],
    fid: [],
    cls: [],
    ttfb: []
  };

  transactions.forEach(transaction => {
    // Extract duration using Sentry parser
    const duration = extractDuration(transaction);
    if (duration > 0) {
      durations.push(duration);
    }

    // Extract memory metrics using Sentry parser
    const memory = extractMemoryMetrics(transaction);
    if (memory.heapUsed) {
      memoryHeapUsed.push(memory.heapUsed);
    }
    if (memory.heapTotal) {
      memoryHeapTotal.push(memory.heapTotal);
    }
    if (memory.rss) {
      memoryRSS.push(memory.rss);
    }

    // Extract CPU usage using Sentry parser
    const cpu = extractCpuUsage(transaction);
    if (cpu !== null) {
      cpuValues.push(cpu);
    }

    // Extract event loop lag using Sentry parser
    const eventLoopLag = extractEventLoopLag(transaction);
    if (eventLoopLag !== null) {
      eventLoopLagValues.push(eventLoopLag);
    }

    // Extract Web Vitals measurements
    const measurements = extractMeasurements(transaction);
    if (measurements.fcp !== null) webVitals.fcp.push(measurements.fcp);
    if (measurements.lcp !== null) webVitals.lcp.push(measurements.lcp);
    if (measurements.fid !== null) webVitals.fid.push(measurements.fid);
    if (measurements.cls !== null) webVitals.cls.push(measurements.cls);
    if (measurements.ttfb !== null) webVitals.ttfb.push(measurements.ttfb);
  });

  // Calculate aggregated metrics
  const calculateStats = (values) => {
    if (values.length === 0) return { avg: 0, min: 0, max: 0 };
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  const durationStats = calculateStats(durations);
  const memoryHeapUsedStats = calculateStats(memoryHeapUsed);
  const memoryHeapTotalStats = calculateStats(memoryHeapTotal);
  const memoryRSSStats = calculateStats(memoryRSS);
  const cpuStats = calculateStats(cpuValues);
  const eventLoopLagStats = calculateStats(eventLoopLagValues);

  // Calculate Web Vitals stats
  const fcpStats = calculateStats(webVitals.fcp);
  const lcpStats = calculateStats(webVitals.lcp);
  const fidStats = calculateStats(webVitals.fid);
  const clsStats = calculateStats(webVitals.cls);
  const ttfbStats = calculateStats(webVitals.ttfb);

  return {
    avgDuration: durationStats.avg,
    minDuration: durationStats.min,
    maxDuration: durationStats.max,
    avgMemoryHeap: memoryHeapUsedStats.avg,
    minMemoryHeap: memoryHeapUsedStats.min,
    maxMemoryHeap: memoryHeapUsedStats.max,
    avgMemoryHeapTotal: memoryHeapTotalStats.avg,
    avgMemoryRSS: memoryRSSStats.avg,
    minMemoryRSS: memoryRSSStats.min,
    maxMemoryRSS: memoryRSSStats.max,
    avgCpu: cpuStats.avg,
    minCpu: cpuStats.min,
    maxCpu: cpuStats.max,
    avgEventLoopLag: eventLoopLagStats.avg,
    minEventLoopLag: eventLoopLagStats.min,
    maxEventLoopLag: eventLoopLagStats.max,
    // Web Vitals
    avgFcp: fcpStats.avg,
    minFcp: fcpStats.min,
    maxFcp: fcpStats.max,
    avgLcp: lcpStats.avg,
    minLcp: lcpStats.min,
    maxLcp: lcpStats.max,
    avgFid: fidStats.avg,
    minFid: fidStats.min,
    maxFid: fidStats.max,
    avgCls: clsStats.avg,
    minCls: clsStats.min,
    maxCls: clsStats.max,
    avgTtfb: ttfbStats.avg,
    minTtfb: ttfbStats.min,
    maxTtfb: ttfbStats.max
  };
}



