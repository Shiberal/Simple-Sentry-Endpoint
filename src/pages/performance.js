import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Dashboard.module.css';

export default function PerformancePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [viewMode, setViewMode] = useState('detailed'); // 'detailed' or 'timeseries'
  const [timeRange, setTimeRange] = useState('30d'); // '7d', '30d', 'custom'
  const [interval, setInterval] = useState('day'); // 'hour' or 'day'
  const [timeSeriesData, setTimeSeriesData] = useState(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      if (viewMode === 'timeseries') {
        fetchTimeSeries();
      } else {
      fetchTransactions();
      }
    }
  }, [selectedProject, viewMode, timeRange, interval, customStartDate, customEndDate]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProject(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/performance?projectId=${selectedProject}`);
      const data = await response.json();
      setTransactions(data.transactions || []);
      setAnalytics(data.analytics || null);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSeries = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      let startDate, endDate;
      const end = new Date();
      
      if (timeRange === '7d') {
        startDate = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === '30d') {
        startDate = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timeRange === 'custom') {
        startDate = customStartDate ? new Date(customStartDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = customEndDate ? new Date(customEndDate) : end;
      } else {
        startDate = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      if (!endDate) {
        endDate = end;
      }
      
      const params = new URLSearchParams({
        projectId: selectedProject,
        interval: interval,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      const response = await fetch(`/api/analytics/performance/timeseries?${params}`);
      const data = await response.json();
      setTimeSeriesData(data);
    } catch (error) {
      console.error('Error fetching time series:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    return `${seconds.toFixed(2)}s`;
  };

  const renderBarChart = (data, labels, color, unit = '') => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data);
    
    return (
      <div style={{ padding: '20px 0' }}>
        {data.map((value, index) => {
          const percentage = max > 0 ? (value / max) * 100 : 0;
          return (
            <div key={index} style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontWeight: '500' }}>{labels[index]}</span>
                <span style={{ color: '#666' }}>{value.toFixed(2)}{unit}</span>
              </div>
              <div style={{ 
                width: '100%', 
                height: '24px', 
                background: '#f0f0f0', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${percentage}%`, 
                  height: '100%', 
                  background: color,
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTimeSeriesChart = (series, metricKey, label, color, unit = '', formatFn = (v) => v.toFixed(2)) => {
    if (!series || series.length === 0) return null;
    
    const values = series.map(s => s.metrics[metricKey] || 0);
    const labels = series.map(s => {
      const date = new Date(s.timestamp);
      if (interval === 'hour') {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    });
    
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const range = max - min || 1;
    
    // Simple line chart using SVG
    const chartHeight = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = 800; // Will be scaled to 100%
    
    // Calculate points in pixel coordinates
    const getX = (index) => {
      const availableWidth = chartWidth - padding.left - padding.right;
      return padding.left + (index / (values.length - 1 || 1)) * availableWidth;
    };
    
    const getY = (value) => {
      const availableHeight = chartHeight - padding.top - padding.bottom;
      return padding.top + availableHeight - ((value - min) / range) * availableHeight;
    };
    
    const points = values.map((value, index) => {
      return `${getX(index)},${getY(value)}`;
    }).join(' ');
    
    return (
      <div style={{ padding: '20px 0' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#333' }}>{label}</h3>
        <div style={{ position: 'relative', width: '100%', background: '#f9f9f9', borderRadius: '4px', padding: '10px', overflowX: 'auto' }}>
          <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ maxWidth: '100%', height: 'auto' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const y = padding.top + (chartHeight - padding.top - padding.bottom) * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e0e0e0"
                  strokeWidth="1"
                />
              );
            })}
            {/* Line chart */}
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="2"
            />
            {/* Data points */}
            {values.map((value, index) => {
              const x = getX(index);
              const y = getY(value);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={color}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${labels[index]}: ${formatFn(value)}${unit}`}</title>
                </circle>
              );
            })}
          </svg>
          {/* Y-axis labels */}
          <div style={{ position: 'absolute', left: '15px', top: '30px', bottom: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: '#666', pointerEvents: 'none' }}>
            <span>{formatFn(max)}{unit}</span>
            <span>{formatFn((max + min) / 2)}{unit}</span>
            <span>{formatFn(min)}{unit}</span>
          </div>
          {/* X-axis labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px', color: '#666', padding: `0 ${padding.left}px 0 ${padding.left}px`, width: `${chartWidth}px`, maxWidth: '100%' }}>
            {labels.filter((_, i) => i % Math.ceil(labels.length / 5) === 0 || i === labels.length - 1).map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px', fontSize: '12px', color: '#666' }}>
          <span>Avg: <strong>{formatFn(values.reduce((a, b) => a + b, 0) / values.length)}{unit}</strong></span>
          <span>Min: <strong>{formatFn(min)}{unit}</strong></span>
          <span>Max: <strong>{formatFn(max)}{unit}</strong></span>
        </div>
      </div>
    );
  };

  if (loading && !analytics && !timeSeriesData) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Performance Monitoring</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          Loading performance data...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📊 Performance Analytics</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedProject || ''}
            onChange={(e) => setSelectedProject(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
            
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', gap: '5px', background: '#f0f0f0', borderRadius: '4px', padding: '2px' }}>
              <button
                onClick={() => setViewMode('detailed')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '3px',
                  border: 'none',
                  background: viewMode === 'detailed' ? '#0070f3' : 'transparent',
                  color: viewMode === 'detailed' ? 'white' : '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: viewMode === 'detailed' ? '600' : '400'
                }}
              >
                Detailed
              </button>
              <button
                onClick={() => setViewMode('timeseries')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '3px',
                  border: 'none',
                  background: viewMode === 'timeseries' ? '#0070f3' : 'transparent',
                  color: viewMode === 'timeseries' ? 'white' : '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: viewMode === 'timeseries' ? '600' : '400'
                }}
              >
                Time Series
              </button>
            </div>

            {/* Time Series Controls */}
            {viewMode === 'timeseries' && (
              <>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px'
                  }}
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
                
                {timeRange === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontSize: '14px'
                      }}
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontSize: '14px'
                      }}
                    />
                  </>
                )}
                
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px'
                  }}
                >
                  <option value="hour">Hourly</option>
                  <option value="day">Daily</option>
                </select>
              </>
            )}
            
          <button
              onClick={viewMode === 'timeseries' ? fetchTimeSeries : fetchTransactions}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              background: '#0070f3',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {viewMode === 'timeseries' && timeSeriesData && (
        <>
          {/* Time Series View */}
          {timeSeriesData.series && timeSeriesData.series.length > 0 ? (
            <div style={{ marginBottom: '30px' }}>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
              }}>
                <div style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Total Intervals</h3>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#0070f3' }}>
                    {timeSeriesData.series.length}
                  </p>
                </div>
                <div style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Total Transactions</h3>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#00E396' }}>
                    {timeSeriesData.series.reduce((sum, s) => sum + s.count, 0)}
                  </p>
                </div>
              </div>

              {/* Time Series Charts */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h2 style={{ marginTop: 0 }}>Transaction Duration Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'avgDuration',
                  'Average Duration',
                  '#667eea',
                  's',
                  (v) => formatDuration(v)
                )}
              </div>

              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h2 style={{ marginTop: 0 }}>Memory Usage Over Time</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                  {renderTimeSeriesChart(
                    timeSeriesData.series,
                    'avgMemoryHeap',
                    'Average Heap Used',
                    '#00E396',
                    ' MB',
                    (v) => (v / 1024 / 1024).toFixed(2)
                  )}
                  {renderTimeSeriesChart(
                    timeSeriesData.series,
                    'avgMemoryRSS',
                    'Average RSS',
                    '#008FFB',
                    ' MB',
                    (v) => (v / 1024 / 1024).toFixed(2)
                  )}
                </div>
              </div>

              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h2 style={{ marginTop: 0 }}>CPU Usage Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'avgCpu',
                  'Average CPU Usage',
                  '#FF4560',
                  '%',
                  (v) => v.toFixed(2)
                )}
              </div>

              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h2 style={{ marginTop: 0 }}>Event Loop Lag Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'avgEventLoopLag',
                  'Average Event Loop Lag',
                  '#775DD0',
                  ' ms',
                  (v) => v.toFixed(2)
                )}
              </div>

              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h2 style={{ marginTop: 0 }}>Transaction Count Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'count',
                  'Transaction Count',
                  '#FEB019',
                  '',
                  (v) => Math.round(v)
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '8px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <p style={{ fontSize: '18px', color: '#666' }}>No time series data available for the selected range.</p>
              <p style={{ color: '#999' }}>Try adjusting the time range or interval.</p>
            </div>
          )}
        </>
      )}

      {viewMode === 'detailed' && analytics && (
        <>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Total Transactions</h3>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#0070f3' }}>
                {analytics.totalTransactions}
              </p>
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Avg Duration</h3>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#00E396' }}>
                {formatDuration(analytics.avgDuration)}
              </p>
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Avg Memory (Heap)</h3>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#FEB019' }}>
                {formatBytes(analytics.avgMemoryHeap)}
              </p>
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Avg CPU Usage</h3>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#FF4560' }}>
                {analytics.avgCpu ? analytics.avgCpu.toFixed(2) : '0'}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div style={{ marginBottom: '30px' }}>
            {analytics.transactionDurations && analytics.transactionDurations.length > 0 && (
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h2 style={{ marginTop: 0 }}>Transaction Duration Over Time</h2>
                {renderBarChart(
                  analytics.transactionDurations,
                  analytics.transactionDurations.map((_, i) => `Transaction ${i + 1}`),
                  'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  's'
                )}
              </div>
            )}

            {analytics.memoryTimeline && analytics.memoryTimeline.length > 0 && (
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h2 style={{ marginTop: 0 }}>Memory Usage Timeline</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Heap Used (MB)</h3>
                    {renderBarChart(
                      analytics.memoryTimeline.map(m => m.heapUsed / 1024 / 1024),
                      analytics.memoryTimeline.map((_, i) => `T${i + 1}`),
                      '#00E396',
                      ' MB'
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Heap Total (MB)</h3>
                    {renderBarChart(
                      analytics.memoryTimeline.map(m => m.heapTotal / 1024 / 1024),
                      analytics.memoryTimeline.map((_, i) => `T${i + 1}`),
                      '#008FFB',
                      ' MB'
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>RSS (MB)</h3>
                    {renderBarChart(
                      analytics.memoryTimeline.map(m => m.rss / 1024 / 1024),
                      analytics.memoryTimeline.map((_, i) => `T${i + 1}`),
                      '#FEB019',
                      ' MB'
                    )}
                  </div>
                </div>
              </div>
            )}

            {analytics.cpuTimeline && analytics.cpuTimeline.length > 0 && (
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h2 style={{ marginTop: 0 }}>CPU Usage Over Time</h2>
                {renderBarChart(
                  analytics.cpuTimeline,
                  analytics.cpuTimeline.map((_, i) => `Transaction ${i + 1}`),
                  'linear-gradient(90deg, #FF4560 0%, #FF6B6B 100%)',
                  '%'
                )}
              </div>
            )}

            {analytics.eventLoopTimeline && analytics.eventLoopTimeline.length > 0 && (
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h2 style={{ marginTop: 0 }}>Event Loop Lag</h2>
                {renderBarChart(
                  analytics.eventLoopTimeline,
                  analytics.eventLoopTimeline.map((_, i) => `Transaction ${i + 1}`),
                  'linear-gradient(90deg, #775DD0 0%, #9B7FE8 100%)',
                  ' ms'
                )}
              </div>
            )}
          </div>

          {/* Transaction List */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0 }}>Recent Transactions</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Transaction</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Duration</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Memory</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>CPU</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => {
                    const data = transaction.data;
                    const duration = data.timestamp - data.start_timestamp;
                    const memory = data.contexts?.device?.app_memory || 0;
                    const breadcrumbs = Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs?.values || [];
                    const cpu = breadcrumbs.find(b => b.message?.includes('CPU usage'))?.message?.match(/[\d.]+/)?.[0] || 'N/A';
                    
                    return (
                      <tr key={transaction.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px' }}>{data.transaction || 'Unnamed'}</td>
                        <td style={{ padding: '12px' }}>{formatDuration(duration)}</td>
                        <td style={{ padding: '12px' }}>{formatBytes(memory)}</td>
                        <td style={{ padding: '12px' }}>{cpu}%</td>
                        <td style={{ padding: '12px' }}>
                          {new Date(data.timestamp * 1000).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewMode === 'detailed' && !analytics && !loading && (
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ fontSize: '18px', color: '#666' }}>No transaction data available yet.</p>
          <p style={{ color: '#999' }}>Send some transaction events to see performance analytics.</p>
        </div>
      )}
    </div>
  );
}

