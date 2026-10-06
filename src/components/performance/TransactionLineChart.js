import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatBytes, formatDuration } from '@/lib/performance-format';
import { buildChartSeries, formatClock, DETAILED_CHART_BUCKET_MINUTES } from '@/lib/performance-series';
import { getCSSVariable } from './chartTheme';

const formatMetricValue = (metric, value) => {
  if (metric === 'memory') {
    const mb = value / 1024 / 1024;
    if (mb >= 1024) {
      return (mb / 1024).toFixed(1) + 'GB';
    }
    return mb.toFixed(1) + 'MB';
  } else if (metric === 'cpu') {
    return value.toFixed(1) + '%';
  } else {
    // For duration, show more readable format
    if (value < 0.001) {
      return (value * 1000).toFixed(0) + 'ms';
    } else if (value < 1) {
      return (value * 1000).toFixed(0) + 'ms';
    } else if (value < 60) {
      return value.toFixed(2) + 's';
    } else {
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(1);
      return `${mins}m ${secs}s`;
    }
  }
};


const formatFullDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

function DetailedTooltip({ active, payload, metric }) {
  if (!active || !payload || payload.length === 0) return null;

  const hoveredPoint = payload.find((entry) => entry?.payload?.point)?.payload;

  if (!hoveredPoint) return null;

  const point = hoveredPoint.point;
  const isAggregated = point.isAggregated || hoveredPoint.isAggregated;
  const sampleCount = point.sampleCount || hoveredPoint.sampleCount || 1;
  const bucketLabel = `${formatClock(point.bucketStartMs || hoveredPoint.bucketStartMs)} - ${formatClock(point.bucketEndMs || hoveredPoint.bucketEndMs)}`;

  return (
    <div style={{
      backgroundColor: getCSSVariable('--bg-primary'),
      border: `1px solid ${getCSSVariable('--border-primary')}`,
      borderRadius: getCSSVariable('--radius-sm'),
      boxShadow: 'var(--shadow-md)',
      color: getCSSVariable('--text-primary'),
      minWidth: '260px',
      padding: 'var(--space-3)'
    }}>
      <div style={{
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-xs)',
        marginBottom: 'var(--space-2)'
      }}>
        {isAggregated ? `${bucketLabel} (${DETAILED_CHART_BUCKET_MINUTES}m bucket)` : formatFullDate(hoveredPoint.timestamp)}
      </div>
      <div
        style={{
          borderTop: '1px solid var(--border-primary)',
          paddingTop: 'var(--space-2)',
          marginTop: 'var(--space-2)'
        }}
      >
        <div style={{
          alignItems: 'center',
          display: 'flex',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)'
        }}>
          <span style={{
            background: hoveredPoint.color,
            borderRadius: '50%',
            display: 'inline-block',
            height: '8px',
            width: '8px'
          }} />
          <strong style={{ fontSize: 'var(--font-sm)' }}>{hoveredPoint.seriesName}</strong>
        </div>
        <div style={{ display: 'grid', gap: '4px', fontSize: 'var(--font-xs)' }}>
          <span>Endpoint: <strong>{!isAggregated && point.method ? `${point.method} ` : ''}{point.endpoint || hoveredPoint.seriesName}</strong></span>
          <span>Samples: <strong>{sampleCount}</strong></span>
          {!isAggregated ? <span>From: <strong>{point.sourceLabel || 'Unknown source'}</strong></span> : null}
          {!isAggregated && point.platform ? <span>Platform: <strong>{point.platform}</strong></span> : null}
          {!isAggregated && point.environment ? <span>Environment: <strong>{point.environment}</strong></span> : null}
          {!isAggregated && point.release ? <span>Release: <strong>{point.release}</strong></span> : null}
          {!isAggregated && point.sdk ? <span>SDK: <strong>{point.sdk}</strong></span> : null}
          <span>{isAggregated ? 'Avg selected metric' : 'Selected metric'}: <strong>{formatMetricValue(metric, hoveredPoint.value)}</strong></span>
          <span>{isAggregated ? 'Avg duration' : 'Duration'}: <strong>{formatDuration(point.duration || 0)}</strong></span>
          <span>{isAggregated ? 'Avg memory' : 'Memory'}: <strong>{formatBytes(point.memory || 0)}</strong></span>
          <span>{isAggregated ? 'Avg CPU' : 'CPU'}: <strong>{Number(point.cpu || 0).toFixed(1)}%</strong></span>
          <span>{isAggregated ? 'Avg event loop lag' : 'Event loop lag'}: <strong>{Number(point.eventLoopLag || 0).toFixed(2)} ms</strong></span>
        </div>
      </div>
    </div>
  );
}

/** Line chart of the selected metric per transaction type: raw points for the last hour, bucket averages before. */
export default function TransactionLineChart({ performanceSeries, metric = 'duration', windowMs, windowLabel }) {
  if (!Array.isArray(performanceSeries) || performanceSeries.length === 0) {
    return (
      <div style={{ 
        background: 'var(--bg-primary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-4)',
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        <h3 style={{ 
          margin: '0 0 var(--space-3) 0', 
          fontSize: 'var(--font-base)', 
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)'
        }}>
          ⚡ Performance by Transaction Type
        </h3>
        <p>No performance data available. Send some transaction events to see performance metrics.</p>
      </div>
    );
  }

  const metricLabel = metric === 'memory' ? 'Memory (MB)' : metric === 'cpu' ? 'CPU (%)' : 'Duration (s)';



  // Generate colors for each transaction type - theme-aware
  const colors = [
    getCSSVariable('--accent-primary') || '#3b82f6',
    getCSSVariable('--error') || '#ef4444',
    getCSSVariable('--warning') || '#f59e0b',
    getCSSVariable('--info') || '#06b6d4',
    getCSSVariable('--success') || '#10b981',
    getCSSVariable('--accent-primary') || '#3b82f6',
    getCSSVariable('--info') || '#06b6d4'
  ];

  const { chartSeries, windowStartMs, windowEndMs } = buildChartSeries({ performanceSeries, metric, windowMs, colors });

  if (chartSeries.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-4)',
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        <h3 style={{
          margin: '0 0 var(--space-3) 0',
          fontSize: 'var(--font-base)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)'
        }}>
          ⚡ Performance by Transaction Type - {metricLabel}
        </h3>
        <p>No performance data available in the last {windowLabel}.</p>
      </div>
    );
  }

  const xTickCount = 7;

  return (
    <div style={{ 
      background: 'var(--bg-primary)', 
      border: '1px solid var(--border-primary)', 
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      marginBottom: 'var(--space-4)'
    }}>
      <h3 style={{ 
        margin: '0 0 var(--space-3) 0', 
        fontSize: 'var(--font-base)', 
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-primary)'
      }}>
        ⚡ Performance by Transaction Type - {metricLabel} (Last {windowLabel}, raw last 1h, {DETAILED_CHART_BUCKET_MINUTES}m avg older)
      </h3>
      <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart accessibilityLayer={false} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={getCSSVariable('--border-primary')} opacity={0.3} />
            <XAxis 
              dataKey="timestampMs"
              type="number"
              domain={[windowStartMs, windowEndMs]}
              tickCount={xTickCount}
              tickFormatter={formatClock}
              tick={{ fill: getCSSVariable('--text-secondary'), fontSize: 11 }}
              stroke={getCSSVariable('--border-primary')}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              dataKey="value"
              type="number"
              tick={{ fill: getCSSVariable('--text-secondary'), fontSize: 12 }}
              stroke={getCSSVariable('--border-primary')}
              tickFormatter={(value) => formatMetricValue(metric, value)}
            />
            <Tooltip
              content={<DetailedTooltip metric={metric} />}
              cursor={{ stroke: getCSSVariable('--border-primary'), strokeDasharray: '3 3' }}
              filterNull
              shared={false}
            />
            {chartSeries.map((series) => {
              return (
                <Line
                  key={series.name}
                  name={series.name}
                  data={series.data}
                  dataKey="value"
                  type="monotone"
                  stroke={series.color}
                  strokeWidth={3}
                  dot={{ fill: series.color, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2) var(--space-3)',
        maxHeight: '64px',
        overflowY: 'auto',
        paddingTop: 'var(--space-2)',
        fontSize: 'var(--font-xs)'
      }}>
        {chartSeries.map((series) => (
          <span
            key={series.name}
            title={series.name}
            style={{
              alignItems: 'center',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              gap: 'var(--space-1)',
              maxWidth: '220px'
            }}
          >
            <span style={{
              background: series.color,
              borderRadius: '50%',
              display: 'inline-block',
              flex: '0 0 auto',
              height: '7px',
              width: '7px'
            }} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {series.name}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
