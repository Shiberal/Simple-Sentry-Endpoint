import { formatBytes, formatDuration } from '@/lib/performance-format';
import PerformanceOverview from './PerformanceOverview';
import TransactionLineChart from './TransactionLineChart';
import MonitorPingSection from './MonitorPingSection';
import TimelineCharts from './TimelineCharts';
import RecentTransactions from './RecentTransactions';
import { StatCard, StatGrid } from './PerformancePanels';

const WEB_VITALS = [
  ['avgFcp', 'FCP', 'First Contentful Paint', (v) => `${v.toFixed(0)}ms`],
  ['avgLcp', 'LCP', 'Largest Contentful Paint', (v) => `${v.toFixed(0)}ms`],
  ['avgFid', 'FID', 'First Input Delay', (v) => `${v.toFixed(0)}ms`],
  ['avgCls', 'CLS', 'Cumulative Layout Shift', (v) => v.toFixed(3)],
  ['avgTtfb', 'TTFB', 'Time to First Byte', (v) => `${v.toFixed(0)}ms`],
];

/** Raw-transaction view: overview, per-endpoint line chart, summary tiles, pings, vitals and tables. */
export default function DetailedView({
  analytics, overview, selectedEndpoint, onSelectEndpoint, filteredPerformanceSeries, selectedMetric,
  windowMs, windowLabel, transactions, monitorCheckIns,
}) {
  const pingStats = analytics.ping;

  return (
    <>
      <PerformanceOverview summary={overview} selectedEndpoint={selectedEndpoint} onSelectEndpoint={onSelectEndpoint} />

      <TransactionLineChart
        performanceSeries={filteredPerformanceSeries}
        metric={selectedMetric}
        windowMs={windowMs}
        windowLabel={windowLabel}
      />

      <div style={{ marginBottom: '30px' }}>
        <StatGrid minWidth={250}>
          <StatCard title="Total Transactions" value={analytics.totalTransactions} color="var(--accent-primary)" />
          <StatCard title="Avg Duration" value={formatDuration(analytics.avgDuration)} color="var(--success)" />
          <StatCard title="Avg Memory (Heap)" value={formatBytes(analytics.avgMemoryHeap)} color="var(--warning)" />
          <StatCard title="Avg CPU Usage" value={`${analytics.avgCpu ? analytics.avgCpu.toFixed(2) : '0'}%`} color="var(--error)" />
        </StatGrid>
      </div>

      {pingStats && pingStats.totalCheckIns > 0 && (
        <MonitorPingSection pingStats={pingStats} monitorCheckIns={monitorCheckIns} />
      )}

      {analytics.webVitals && (
        <div style={{ marginBottom: '30px' }}>
          <StatGrid minWidth={200}>
            {WEB_VITALS.map(([key, title, note, format]) => analytics.webVitals[key] != null && (
              <StatCard
                key={key}
                title={title}
                value={format(analytics.webVitals[key])}
                color="var(--accent-primary)"
                valueSize="var(--font-xl)"
                note={note}
              />
            ))}
          </StatGrid>
        </div>
      )}

      <TimelineCharts analytics={analytics} />

      <RecentTransactions transactions={transactions} />
    </>
  );
}
