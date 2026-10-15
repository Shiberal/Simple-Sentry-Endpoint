import { getTransactionSourceContext } from '@/lib/performance-format';

/**
 * Groups transactions by name into per-endpoint series (newest first) with duration, memory,
 * CPU and event-loop-lag samples. Also returns the sorted endpoint names for the filter.
 */
export function buildPerformanceSeries(transactions) {
  if (!transactions || transactions.length === 0) return { series: [], endpoints: [] };
  const grouped = {};

  transactions.forEach(transaction => {
    const transactionName = transaction.data?.transaction || 'Unknown';
    const sourceContext = getTransactionSourceContext(transaction);
    const timestamp = transaction.data?.timestamp || transaction.createdAt;
    const startTimestamp = transaction.data?.start_timestamp;

    if (!grouped[transactionName]) {
      grouped[transactionName] = [];
    }

    // Calculate duration - Sentry timestamps are in seconds
    let duration = 0;
    if (timestamp && startTimestamp && typeof timestamp === 'number' && typeof startTimestamp === 'number') {
      // Sentry uses Unix timestamps in seconds
      duration = timestamp - startTimestamp;
    }

    // Extract memory from Sentry contexts (preferred)
    let memory = 0;
    if (transaction.data?.contexts?.app?.app_memory) {
      const appMemory = transaction.data.contexts.app.app_memory;
      // If it's a large number (> 1GB), assume bytes, otherwise assume MB
      memory = appMemory > 1024 * 1024 * 1024 ? appMemory : appMemory * 1024 * 1024;
    } else if (transaction.data?.contexts?.device?.memory_size) {
      memory = transaction.data.contexts.device.memory_size * 1024 * 1024;
    } else {
      // Fallback to old method
      memory = transaction.data?.contexts?.device?.app_memory || 0;
    }

    // Extract CPU from contexts (preferred) or breadcrumbs
    let cpu = 0;
    if (transaction.data?.contexts?.device?.cpu_percent !== undefined) {
      cpu = transaction.data.contexts.device.cpu_percent;
    } else if (transaction.data?.contexts?.runtime?.cpu_percent !== undefined) {
      cpu = transaction.data.contexts.runtime.cpu_percent;
    } else {
      // Fallback to breadcrumbs
      const breadcrumbs = Array.isArray(transaction.data?.breadcrumbs) 
        ? transaction.data.breadcrumbs 
        : transaction.data?.breadcrumbs?.values || [];
      const cpuBreadcrumb = breadcrumbs.find(b => 
        b.message && b.message.includes('CPU usage')
      );
      if (cpuBreadcrumb) {
        const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
        if (cpuMatch) {
          cpu = parseFloat(cpuMatch[1]);
        }
      }
    }

    // Extract event loop lag from breadcrumbs
    let eventLoopLag = 0;
    const breadcrumbs = Array.isArray(transaction.data?.breadcrumbs) 
      ? transaction.data.breadcrumbs 
      : transaction.data?.breadcrumbs?.values || [];
    const eventLoopBreadcrumb = breadcrumbs.find(b => 
      b.message && b.message.includes('event loop lag')
    );
    if (eventLoopBreadcrumb) {
      const lagMatch = eventLoopBreadcrumb.message.match(/([\d.]+)\s*ms/);
      if (lagMatch) {
        eventLoopLag = parseFloat(lagMatch[1]);
      }
    }

    grouped[transactionName].push({
      date: new Date(transaction.createdAt).toISOString().split('T')[0],
      timestamp: transaction.createdAt,
      transactionId: transaction.id,
      duration: duration,
      memory: memory,
      cpu: cpu,
      eventLoopLag: eventLoopLag,
      ...sourceContext
    });
  });

  // Sort each group by timestamp and convert to time series
  const series = Object.entries(grouped).map(([name, points]) => ({
    name,
    data: points.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }));

  return { series, endpoints: Object.keys(grouped).sort() };
}

const DETAILED_CHART_RECENT_WINDOW_MS = 60 * 60 * 1000;
export const DETAILED_CHART_BUCKET_MINUTES = 5;
const DETAILED_CHART_BUCKET_MS = DETAILED_CHART_BUCKET_MINUTES * 60 * 1000;

export const formatClock = (timestamp) =>
  new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

export const METRIC_VALUE = {
  memory: (point) => point.memory || 0,
  cpu: (point) => point.cpu || 0,
  duration: (point) => point.duration || 0,
};

/**
 * Turns per-endpoint series into chart lines: raw points for the last hour, bucket averages for
 * older data. Longer windows get coarser buckets so a chart stays around 200 points.
 */
export function buildChartSeries({ performanceSeries, metric, windowMs, colors }) {
  const getMetricValue = METRIC_VALUE[metric] || METRIC_VALUE.duration;
  // Longer periods get coarser buckets so the chart stays around 200 points
  const bucketMs = Math.max(DETAILED_CHART_BUCKET_MS, Math.ceil(windowMs / 200 / 60000) * 60000);
  const nowMs = Date.now();
  const windowEndMs = Math.ceil(nowMs / bucketMs) * bucketMs;
  const windowStartMs = windowEndMs - windowMs;
  const recentStartMs = windowEndMs - DETAILED_CHART_RECENT_WINDOW_MS;
  const toFiniteNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const average = (sum, count) => (count > 0 ? sum / count : 0);

  const chartSeries = performanceSeries
    .map((series, index) => {
      const seriesName = series?.name || 'Unknown';
      const color = colors[index % colors.length];
      const buckets = new Map();
      const rawRecentPoints = [];

      if (Array.isArray(series?.data)) {
        series.data.forEach((point) => {
          const timestampMs = point?.timestamp ? new Date(point.timestamp).getTime() : NaN;
          const value = point ? getMetricValue(point) : NaN;

          if (
            !Number.isFinite(timestampMs) ||
            !Number.isFinite(value) ||
            timestampMs < windowStartMs ||
            timestampMs > windowEndMs
          ) {
            return;
          }

          if (timestampMs >= recentStartMs) {
            rawRecentPoints.push({
              bucketEndMs: timestampMs,
              bucketStartMs: timestampMs,
              color,
              date: formatClock(point.timestamp),
              isAggregated: false,
              point: {
                ...point,
                bucketEndMs: timestampMs,
                bucketStartMs: timestampMs,
                isAggregated: false,
                sampleCount: 1
              },
              sampleCount: 1,
              seriesName,
              timestamp: point.timestamp,
              timestampMs,
              transactionId: point.transactionId,
              value
            });
            return;
          }

          const bucketStartMs = Math.floor(timestampMs / bucketMs) * bucketMs;
          const bucket = buckets.get(bucketStartMs) || {
            count: 0,
            durationSum: 0,
            eventLoopLagSum: 0,
            lastPoint: point,
            memorySum: 0,
            cpuSum: 0,
            valueSum: 0
          };

          bucket.count += 1;
          bucket.durationSum += toFiniteNumber(point.duration);
          bucket.eventLoopLagSum += toFiniteNumber(point.eventLoopLag);
          bucket.memorySum += toFiniteNumber(point.memory);
          bucket.cpuSum += toFiniteNumber(point.cpu);
          bucket.valueSum += value;
          bucket.lastPoint = point;
          buckets.set(bucketStartMs, bucket);
        });
      }

      const bucketedPoints = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([bucketStartMs, bucket]) => {
          const bucketEndMs = bucketStartMs + bucketMs;
          const timestamp = new Date(bucketStartMs).toISOString();
          const point = {
            ...bucket.lastPoint,
            bucketEndMs,
            bucketStartMs,
            cpu: average(bucket.cpuSum, bucket.count),
            duration: average(bucket.durationSum, bucket.count),
            eventLoopLag: average(bucket.eventLoopLagSum, bucket.count),
            isAggregated: true,
            memory: average(bucket.memorySum, bucket.count),
            sampleCount: bucket.count,
            timestamp
          };

          return {
            bucketEndMs,
            bucketStartMs,
            color,
            date: formatClock(bucketStartMs),
            isAggregated: true,
            point,
            sampleCount: bucket.count,
            seriesName,
            timestamp,
            timestampMs: bucketStartMs,
            value: average(bucket.valueSum, bucket.count)
          };
        });
      const data = [...bucketedPoints, ...rawRecentPoints]
        .sort((a, b) => {
          if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
          return String(a.transactionId || '').localeCompare(String(b.transactionId || ''));
        });

      return { color, data, name: seriesName };
    })
    .filter((series) => series.data.length > 0);

  return { chartSeries, windowStartMs, windowEndMs };
}
