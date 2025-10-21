import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Fetch all transaction events for this project
    const transactions = await prisma.event.findMany({
      where: {
        projectId: parseInt(projectId),
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
  
  let totalDuration = 0;
  let totalMemoryHeap = 0;
  let totalMemoryRSS = 0;
  let totalCpu = 0;
  let cpuCount = 0;
  let eventLoopCount = 0;

  transactions.forEach(transaction => {
    const data = transaction.data;
    
    // Calculate duration
    if (data.timestamp && data.start_timestamp) {
      const duration = data.timestamp - data.start_timestamp;
      durations.push(duration);
      totalDuration += duration;
    }

    // Get breadcrumbs array (handle both formats: array directly or object with values)
    const breadcrumbs = Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs?.values || [];

    // Extract memory data from breadcrumbs
    const memoryBreadcrumb = breadcrumbs.find(b => 
      b.message && (b.message.includes('Heap Used') || b.message.includes('memory metrics'))
    );
    
    if (memoryBreadcrumb) {
      // Parse memory from breadcrumb message or use context data
      const heapUsedMatch = breadcrumbs.find(b => b.message?.includes('Heap Used:'))?.message?.match(/([\d.]+)\s*MB/);
      const heapTotalMatch = breadcrumbs.find(b => b.message?.includes('Heap Total:'))?.message?.match(/([\d.]+)\s*MB/);
      const rssMatch = breadcrumbs.find(b => b.message?.includes('RSS:'))?.message?.match(/([\d.]+)\s*MB/);
      
      const heapUsed = heapUsedMatch ? parseFloat(heapUsedMatch[1]) * 1024 * 1024 : 0;
      const heapTotal = heapTotalMatch ? parseFloat(heapTotalMatch[1]) * 1024 * 1024 : 0;
      const rss = rssMatch ? parseFloat(rssMatch[1]) * 1024 * 1024 : 0;
      
      if (heapUsed || heapTotal || rss) {
        memoryTimeline.push({ heapUsed, heapTotal, rss });
        totalMemoryHeap += heapUsed;
        totalMemoryRSS += rss;
      }
    }

    // Extract CPU data
    const cpuBreadcrumb = breadcrumbs.find(b => 
      b.message && b.message.includes('CPU usage')
    );
    
    if (cpuBreadcrumb) {
      const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
      if (cpuMatch) {
        const cpu = parseFloat(cpuMatch[1]);
        cpuTimeline.push(cpu);
        totalCpu += cpu;
        cpuCount++;
      }
    }

    // Extract event loop lag
    const eventLoopBreadcrumb = breadcrumbs.find(b => 
      b.message && b.message.includes('event loop lag')
    );
    
    if (eventLoopBreadcrumb) {
      const lagMatch = eventLoopBreadcrumb.message.match(/([\d.]+)\s*ms/);
      if (lagMatch) {
        const lag = parseFloat(lagMatch[1]);
        eventLoopTimeline.push(lag);
        eventLoopCount++;
      }
    }
  });

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
    eventLoopTimeline
  };
}

