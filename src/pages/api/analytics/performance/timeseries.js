import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

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

  transactions.forEach(transaction => {
    const data = transaction.data;
    
    // Calculate duration
    if (data.timestamp && data.start_timestamp) {
      const duration = data.timestamp - data.start_timestamp;
      durations.push(duration);
    }

    // Get breadcrumbs array
    const breadcrumbs = Array.isArray(data.breadcrumbs) 
      ? data.breadcrumbs 
      : data.breadcrumbs?.values || [];

    // Extract memory data from breadcrumbs
    const heapUsedMatch = breadcrumbs.find(b => b.message?.includes('Heap Used:'))?.message?.match(/([\d.]+)\s*MB/);
    const heapTotalMatch = breadcrumbs.find(b => b.message?.includes('Heap Total:'))?.message?.match(/([\d.]+)\s*MB/);
    const rssMatch = breadcrumbs.find(b => b.message?.includes('RSS:'))?.message?.match(/([\d.]+)\s*MB/);
    
    if (heapUsedMatch) {
      const heapUsed = parseFloat(heapUsedMatch[1]) * 1024 * 1024;
      memoryHeapUsed.push(heapUsed);
    }
    
    if (heapTotalMatch) {
      const heapTotal = parseFloat(heapTotalMatch[1]) * 1024 * 1024;
      memoryHeapTotal.push(heapTotal);
    }
    
    if (rssMatch) {
      const rss = parseFloat(rssMatch[1]) * 1024 * 1024;
      memoryRSS.push(rss);
    }

    // Extract CPU data
    const cpuBreadcrumb = breadcrumbs.find(b => 
      b.message && b.message.includes('CPU usage')
    );
    
    if (cpuBreadcrumb) {
      const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
      if (cpuMatch) {
        cpuValues.push(parseFloat(cpuMatch[1]));
      }
    }

    // Extract event loop lag
    const eventLoopBreadcrumb = breadcrumbs.find(b => 
      b.message && b.message.includes('event loop lag')
    );
    
    if (eventLoopBreadcrumb) {
      const lagMatch = eventLoopBreadcrumb.message.match(/([\d.]+)\s*ms/);
      if (lagMatch) {
        eventLoopLagValues.push(parseFloat(lagMatch[1]));
      }
    }
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
    maxEventLoopLag: eventLoopLagStats.max
  };
}

