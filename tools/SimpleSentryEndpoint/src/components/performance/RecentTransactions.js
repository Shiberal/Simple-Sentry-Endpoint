import { formatBytes, formatDuration } from '@/lib/performance-format';
import { DataTable, Panel } from './PerformancePanels';

function describeTransaction(transaction) {
  const data = transaction.data;

  // Sentry timestamps are in seconds (Unix timestamp)
  const timestamp = data.timestamp;
  const startTimestamp = data.start_timestamp;

  let duration = 0;
  if (timestamp && startTimestamp && typeof timestamp === 'number' && typeof startTimestamp === 'number') {
    duration = timestamp - startTimestamp;
  }

  // Memory from Sentry contexts (preferred) or fallback
  let memory = 0;
  if (data.contexts?.app?.app_memory) {
    const appMemory = data.contexts.app.app_memory;
    // If it's a large number (> 1GB), assume bytes, otherwise assume MB
    memory = appMemory > 1024 * 1024 * 1024 ? appMemory : appMemory * 1024 * 1024;
  } else if (data.contexts?.device?.memory_size) {
    memory = data.contexts.device.memory_size * 1024 * 1024;
  } else {
    memory = data.contexts?.device?.app_memory || 0;
  }

  // CPU from contexts or breadcrumbs
  let cpu = 'N/A';
  if (data.contexts?.device?.cpu_percent !== undefined) {
    cpu = data.contexts.device.cpu_percent.toFixed(1);
  } else if (data.contexts?.runtime?.cpu_percent !== undefined) {
    cpu = data.contexts.runtime.cpu_percent.toFixed(1);
  } else {
    const breadcrumbs = Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs?.values || [];
    const cpuBreadcrumb = breadcrumbs.find(b => b.message?.includes('CPU usage'));
    if (cpuBreadcrumb) {
      const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
      if (cpuMatch) {
        cpu = parseFloat(cpuMatch[1]).toFixed(1);
      }
    }
  }

  const displayTimestamp = timestamp && typeof timestamp === 'number'
    ? new Date(timestamp * 1000)
    : new Date(transaction.createdAt);

  return { name: data.transaction || 'Unnamed', duration, memory, cpu, displayTimestamp };
}

export default function RecentTransactions({ transactions }) {
  return (
    <Panel title="Recent Transactions">
      <DataTable
        columns={['Transaction', 'Duration', 'Memory', 'CPU', 'Timestamp']}
        rows={transactions.map((transaction) => {
          const t = describeTransaction(transaction);
          return {
            key: transaction.id,
            cells: [
              { value: t.name },
              { value: formatDuration(t.duration) },
              { value: formatBytes(t.memory) },
              { value: `${t.cpu}%` },
              { value: t.displayTimestamp.toLocaleString(), style: { color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' } },
            ],
          };
        })}
      />
    </Panel>
  );
}
