import { formatDuration, formatPingDuration } from '@/lib/performance-format';
import { EmptyPanel, Panel, StatCard } from './PerformancePanels';
import TimeSeriesChart from './TimeSeriesChart';

const mb = (v) => (v / 1024 / 1024).toFixed(2);
const WEB_VITALS = [
  { key: 'avgFcp', label: 'First Contentful Paint (FCP)', color: 'var(--accent-primary)', format: (v) => Math.round(v), unit: 'ms' },
  { key: 'avgLcp', label: 'Largest Contentful Paint (LCP)', color: 'var(--success)', format: (v) => Math.round(v), unit: 'ms' },
  { key: 'avgFid', label: 'First Input Delay (FID)', color: 'var(--error)', format: (v) => Math.round(v), unit: 'ms' },
  { key: 'avgCls', label: 'Cumulative Layout Shift (CLS)', color: 'var(--info)', format: (v) => v.toFixed(3), unit: '' },
  { key: 'avgTtfb', label: 'Time to First Byte (TTFB)', color: 'var(--warning)', format: (v) => Math.round(v), unit: 'ms' },
];

const twoColumns = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' };

/** Aggregated metrics over time (hourly or daily buckets). */
export default function TimeSeriesView({ data, interval }) {
  const series = data.series;
  if (!Array.isArray(series) || series.length === 0) {
    return (
      <EmptyPanel
        title="No time series data available for the selected range."
        hint="Try adjusting the time range or interval."
      />
    );
  }

  const chart = (metricKey, label, color, unit, formatFn) => (
    <TimeSeriesChart series={series} metricKey={metricKey} label={label} color={color} unit={unit} formatFn={formatFn} interval={interval} />
  );
  const visibleVitals = WEB_VITALS.filter((v) => series.some((s) => s.metrics?.[v.key] !== undefined));

  return (
    <div style={{ marginBottom: '30px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        <StatCard title="Total Intervals" value={series.length} color="var(--accent-primary)" />
        <StatCard title="Total Transactions" value={series.reduce((sum, s) => sum + s.count, 0)} color="var(--success)" />
        <StatCard title="Total Monitor Pings" value={series.reduce((sum, s) => sum + (s.pingCount || 0), 0)} color="var(--info)" />
      </div>

      <Panel title="Transaction Duration Over Time" marginBottom="var(--space-4)">
        {chart('avgDuration', 'Average Duration', 'var(--accent-primary)', 's', (v) => formatDuration(v))}
      </Panel>

      <Panel title="Memory Usage Over Time" marginBottom="var(--space-4)">
        <div style={twoColumns}>
          {chart('avgMemoryHeap', 'Average Heap Used', 'var(--success)', ' MB', mb)}
          {chart('avgMemoryRSS', 'Average RSS', 'var(--info)', ' MB', mb)}
        </div>
      </Panel>

      <Panel title="CPU Usage Over Time" marginBottom="var(--space-4)">
        {chart('avgCpu', 'Average CPU Usage', 'var(--error)', '%', (v) => v.toFixed(2))}
      </Panel>

      <Panel title="Event Loop Lag Over Time" marginBottom="var(--space-4)">
        {chart('avgEventLoopLag', 'Average Event Loop Lag', 'var(--info)', ' ms', (v) => v.toFixed(2))}
      </Panel>

      <Panel title="Transaction Count Over Time" marginBottom="var(--space-4)">
        {chart('count', 'Transaction Count', 'var(--warning)', '', (v) => Math.round(v))}
      </Panel>

      {series.some(s => (s.metrics?.pingCount || 0) > 0) && (
        <Panel title="Monitor Ping Performance" marginBottom="var(--space-4)">
          <div style={twoColumns}>
            {chart('avgPingDurationMs', 'Average Ping Duration', 'var(--info)', '', (v) => formatPingDuration(v))}
            {chart('uptimePercent', 'Ping Uptime', 'var(--success)', '%', (v) => v.toFixed(1))}
          </div>
        </Panel>
      )}

      {visibleVitals.length > 0 && (
        <Panel title="Core Web Vitals" marginBottom="var(--space-4)">
          <div style={twoColumns}>
            {visibleVitals.map((v) => (
              <div key={v.key}>{chart(v.key, v.label, v.color, v.unit, v.format)}</div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
