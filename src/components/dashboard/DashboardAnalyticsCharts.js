import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import styles from '@/styles/Dashboard.module.css';

function cssVar(name) {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Issue trends + top issues (Recharts loaded only with this chunk).
 */
export default function DashboardAnalyticsCharts({ analyticsData }) {
  if (!analyticsData) {
    return (
      <div className={styles.analyticsGrid} aria-busy="true">
        <div style={{ height: 240, minHeight: 240, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }} />
        <div style={{ height: 240, minHeight: 240, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  const { trends = [], topIssues = [] } = analyticsData;
  const chartData = [...trends].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className={styles.analyticsGrid}>
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          minHeight: 260,
        }}
      >
        <h2
          style={{
            margin: '0 0 var(--space-3)',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          New issues (7 days)
        </h2>
        {chartData.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>No trend data yet.</p>
        ) : (
          <div style={{ width: '100%', height: 240, minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border-primary')} opacity={0.35} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: cssVar('--text-secondary'), fontSize: 10 }}
                  stroke={cssVar('--border-primary')}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: cssVar('--text-secondary'), fontSize: 10 }}
                  stroke={cssVar('--border-primary')}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: cssVar('--bg-primary'),
                    border: `1px solid ${cssVar('--border-primary')}`,
                    borderRadius: cssVar('--radius-sm'),
                    color: cssVar('--text-primary'),
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Issues"
                  stroke={cssVar('--accent-primary') || '#6366f1'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          maxHeight: 280,
          overflow: 'auto',
        }}
      >
        <h2
          style={{
            margin: '0 0 var(--space-3)',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          Top issues
        </h2>
        {topIssues.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>No issues ranked yet.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
            {topIssues.slice(0, 8).map((issue) => (
              <li key={issue.id} style={{ marginBottom: 'var(--space-2)' }}>
                <span style={{ fontWeight: 600 }}>{issue.count}×</span>{' '}
                <span title={issue.title}>{issue.title?.slice(0, 80) || 'Untitled'}</span>
                {issue.project?.name ? (
                  <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: 'var(--font-xs)' }}>
                    {issue.project.name}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
