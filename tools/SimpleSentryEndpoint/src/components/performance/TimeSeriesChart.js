import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCSSVariable } from './chartTheme';

export default function TimeSeriesChart({ series, metricKey, label, color, unit = '', formatFn = (v) => v.toFixed(2), interval }) {
  if (!series || !Array.isArray(series) || series.length === 0) return null;

  // Transform data for Recharts
  const chartData = series.map(s => {
    const date = new Date(s.timestamp);
    let dateLabel;
    if (interval === 'hour') {
      dateLabel = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    } else {
      dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return {
      timestamp: s.timestamp,
      date: dateLabel,
      value: s.metrics?.[metricKey] || 0
    };
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort chronologically (newest first)

  const values = chartData.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div style={{ padding: 'var(--space-5) 0' }}>
      <h3 style={{ fontSize: 'var(--font-base)', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>{label}</h3>
      <div style={{ width: '100%', height: '250px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', minHeight: '250px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={getCSSVariable('--border-primary')} opacity={0.3} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: getCSSVariable('--text-secondary'), fontSize: 11 }}
              stroke={getCSSVariable('--border-primary')}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fill: getCSSVariable('--text-secondary'), fontSize: 12 }}
              stroke={getCSSVariable('--border-primary')}
              tickFormatter={(value) => `${formatFn(value)}${unit}`}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: getCSSVariable('--bg-primary'),
                border: `1px solid ${getCSSVariable('--border-primary')}`,
                borderRadius: getCSSVariable('--radius-sm'),
                color: getCSSVariable('--text-primary')
              }}
              labelStyle={{ color: getCSSVariable('--text-primary') }}
              formatter={(value) => [`${formatFn(value)}${unit}`, label]}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 'var(--space-5)', marginTop: 'var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
        <span>Avg: <strong>{formatFn(avg)}{unit}</strong></span>
        <span>Min: <strong>{formatFn(min)}{unit}</strong></span>
        <span>Max: <strong>{formatFn(max)}{unit}</strong></span>
      </div>
    </div>
  );
}
