import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCSSVariable } from './chartTheme';

export default function MetricBarChart({ data, labels, color, unit = '' }) {
  if (!data || data.length === 0) return null;

  // Transform data for Recharts
  const chartData = data.map((value, index) => ({
    name: labels[index],
    value: value
  }));

  return (
    <div style={{ padding: '20px 0', width: '100%', height: '300px', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={getCSSVariable('--border-primary')} opacity={0.3} />
          <XAxis 
            dataKey="name" 
            tick={{ fill: getCSSVariable('--text-secondary'), fontSize: 12 }}
            stroke={getCSSVariable('--border-primary')}
          />
          <YAxis 
            tick={{ fill: getCSSVariable('--text-secondary'), fontSize: 12 }}
            stroke={getCSSVariable('--border-primary')}
            tickFormatter={(value) => `${value.toFixed(2)}${unit}`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: getCSSVariable('--bg-primary'),
              border: `1px solid ${getCSSVariable('--border-primary')}`,
              borderRadius: getCSSVariable('--radius-sm'),
              color: getCSSVariable('--text-primary')
            }}
            labelStyle={{ color: getCSSVariable('--text-primary') }}
            formatter={(value) => [`${value.toFixed(2)}${unit}`, 'Value']}
          />
          <Bar 
            dataKey="value" 
            fill={color}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
