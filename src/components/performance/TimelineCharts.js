import { Panel } from './PerformancePanels';
import MetricBarChart from './MetricBarChart';

const filled = (list) => Array.isArray(list) && list.length > 0;
const MB = 1024 * 1024;

/** Per-transaction bar charts: duration, memory, CPU and event-loop lag. */
export default function TimelineCharts({ analytics }) {
  const fallbackLabels = (list) => analytics.transactionNames || list.map((unused, i) => `T${i + 1}`);

  return (
    <div style={{ marginBottom: '30px' }}>
      {filled(analytics.transactionDurations) && (
        <Panel title="Transaction Duration Over Time" padding="var(--space-5)" marginBottom="var(--space-5)">
          <MetricBarChart
            data={analytics.transactionDurations}
            labels={fallbackLabels(analytics.transactionDurations)}
            color="var(--accent-primary)"
            unit="s"
          />
        </Panel>
      )}

      {filled(analytics.memoryTimeline) && (
        <Panel title="Memory Usage Timeline" marginBottom="var(--space-4)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            {[
              ['Heap Used (MB)', 'heapUsed', 'var(--success)'],
              ['Heap Total (MB)', 'heapTotal', 'var(--info)'],
              ['RSS (MB)', 'rss', 'var(--warning)'],
            ].map(([title, field, color]) => (
              <div key={field}>
                <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>{title}</h3>
                <MetricBarChart
                  data={analytics.memoryTimeline.map(m => m[field] / MB)}
                  labels={fallbackLabels(analytics.memoryTimeline)}
                  color={color}
                  unit=" MB"
                />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {filled(analytics.cpuTimeline) && (
        <Panel title="CPU Usage Over Time" marginBottom="var(--space-4)">
          <MetricBarChart data={analytics.cpuTimeline} labels={fallbackLabels(analytics.cpuTimeline)} color="var(--error)" unit="%" />
        </Panel>
      )}

      {filled(analytics.eventLoopTimeline) && (
        <Panel title="Event Loop Lag">
          <MetricBarChart data={analytics.eventLoopTimeline} labels={fallbackLabels(analytics.eventLoopTimeline)} color="var(--info)" unit=" ms" />
        </Panel>
      )}
    </div>
  );
}
