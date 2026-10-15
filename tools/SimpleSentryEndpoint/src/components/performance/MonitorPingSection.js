import { formatPingDuration } from '@/lib/performance-format';
import { DataTable, Panel, StatCard, StatGrid } from './PerformancePanels';
import MetricBarChart from './MetricBarChart';

/** Uptime tiles, duration chart and the latest check-ins of the project's monitors. */
export default function MonitorPingSection({ pingStats, monitorCheckIns }) {
  return (
    <div style={{ marginBottom: '30px' }}>
      <StatGrid minWidth={220} marginBottom="var(--space-5)">
        <StatCard title="Monitor Pings" value={pingStats.totalCheckIns} color="var(--info)" />
        <StatCard
          title="Ping Uptime"
          value={pingStats.uptimePercent === null ? 'N/A' : `${pingStats.uptimePercent.toFixed(1)}%`}
          color="var(--success)"
        />
        <StatCard title="Avg Ping Duration" value={formatPingDuration(pingStats.avgDurationMs)} color="var(--accent-primary)" />
        <StatCard title="Failed Pings" value={pingStats.failedCheckIns} color={pingStats.failedCheckIns > 0 ? 'var(--error)' : 'var(--success)'} />
      </StatGrid>

      {Array.isArray(pingStats.durationsMs) && pingStats.durationsMs.length > 0 && (
        <Panel title="Monitor Ping Duration" padding="var(--space-5)" marginBottom="var(--space-5)">
          <MetricBarChart
            data={pingStats.durationsMs}
            labels={pingStats.labels || pingStats.durationsMs.map((unused, i) => `P${i + 1}`)}
            color="var(--info)"
            unit=" ms"
          />
        </Panel>
      )}

      <Panel title="Recent Monitor Pings">
        <DataTable
          columns={['Monitor', 'Status', 'Duration', 'Environment', 'Timestamp']}
          rows={monitorCheckIns.map((checkIn) => {
            const duration = Number(checkIn.durationMs);
            return {
              key: checkIn.id,
              cells: [
                { value: checkIn.monitor?.name || checkIn.monitor?.slug || 'Monitor' },
                { value: checkIn.status, style: { color: checkIn.status === 'ok' ? 'var(--success)' : 'var(--error)', fontWeight: 'var(--weight-semibold)' } },
                { value: Number.isFinite(duration) ? formatPingDuration(duration) : 'N/A' },
                { value: checkIn.environment || checkIn.monitor?.environment || 'N/A' },
                { value: new Date(checkIn.createdAt).toLocaleString(), style: { color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' } },
              ],
            };
          })}
        />
      </Panel>
    </div>
  );
}
