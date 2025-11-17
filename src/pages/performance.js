import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
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
  const [performanceSeries, setPerformanceSeries] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState('all'); // Filter by endpoint/transaction name
  const [selectedMetric, setSelectedMetric] = useState('duration'); // duration, memory, cpu
  const [availableEndpoints, setAvailableEndpoints] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (viewMode === 'timeseries') {
      if (selectedProject) {
        fetchTimeSeries();
      }
    } else {
      fetchTransactions();
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
    if (selectedProject === null || selectedProject === undefined) {
      setTransactions([]);
      setAnalytics(null);
      setPerformanceSeries([]);
      setAvailableEndpoints([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/performance?projectId=${selectedProject}`);
      const data = await response.json();
      setTransactions(data.transactions || []);
      setAnalytics(data.analytics || null);
      
      // Group transactions by transaction type for line chart
      if (data.transactions && data.transactions.length > 0) {
        const grouped = {};
        
        data.transactions.forEach(transaction => {
          const transactionName = transaction.data?.transaction || 'Unknown';
          const timestamp = transaction.data?.timestamp || transaction.createdAt;
          const startTimestamp = transaction.data?.start_timestamp;
          
          if (!grouped[transactionName]) {
            grouped[transactionName] = [];
          }
          
          // Calculate duration
          let duration = 0;
          if (timestamp && startTimestamp) {
            duration = timestamp - startTimestamp;
          }
          
          // Extract memory
          const memory = transaction.data?.contexts?.device?.app_memory || 
                        transaction.data?.contexts?.app?.app_memory || 0;
          
          // Extract CPU and event loop lag from breadcrumbs
          let cpu = 0;
          let eventLoopLag = 0;
          const breadcrumbs = Array.isArray(transaction.data?.breadcrumbs) 
            ? transaction.data.breadcrumbs 
            : transaction.data?.breadcrumbs?.values || [];
          
          // Find CPU breadcrumb
          const cpuBreadcrumb = breadcrumbs.find(b => 
            b.message && b.message.includes('CPU usage')
          );
          if (cpuBreadcrumb) {
            const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
            if (cpuMatch) {
              cpu = parseFloat(cpuMatch[1]);
            }
          }
          
          // Find event loop lag breadcrumb
          const eventLoopBreadcrumb = breadcrumbs.find(b => 
            b.message && b.message.includes('event loop lag')
          );
          if (eventLoopBreadcrumb) {
            const lagMatch = eventLoopBreadcrumb.message.match(/([\d.]+)\s*ms/);
            if (lagMatch) {
              eventLoopLag = parseFloat(lagMatch[1]);
            }
          }
          
          grouped[transactionName].push({
            date: new Date(transaction.createdAt).toISOString().split('T')[0],
            timestamp: transaction.createdAt,
            duration: duration,
            memory: memory,
            cpu: cpu,
            eventLoopLag: eventLoopLag
          });
        });
        
        // Sort each group by timestamp and convert to time series
        const series = Object.entries(grouped).map(([name, points]) => ({
          name,
          data: points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        }));
        
        setPerformanceSeries(series);
        
        // Extract available endpoints for filter
        const endpoints = Object.keys(grouped).sort();
        setAvailableEndpoints(endpoints);
      } else {
        setPerformanceSeries([]);
        setAvailableEndpoints([]);
      }
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

  // Render line chart for performance data grouped by transaction type
  const renderLineChart = (performanceSeries, metric = 'duration') => {
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
    
    const chartHeight = 200;
    const svgWidth = 800;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartAreaHeight = chartHeight - padding.top - padding.bottom;
    const chartAreaWidth = svgWidth - padding.left - padding.right;
    
    // Get all unique timestamps and sort them
    const allTimestamps = new Set();
    if (Array.isArray(performanceSeries)) {
      performanceSeries.forEach(series => {
        if (series && Array.isArray(series.data)) {
          series.data.forEach(point => {
            if (point && point.timestamp) {
              allTimestamps.add(point.timestamp);
            }
          });
        }
      });
    }
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => new Date(a) - new Date(b));
    
    // Get metric value based on selected metric
    const getMetricValue = (point) => {
      switch(metric) {
        case 'memory':
          return point.memory || 0;
        case 'cpu':
          return point.cpu || 0;
        default:
          return point.duration || 0;
      }
    };

    // Get max value for scaling based on selected metric
    const maxValue = Math.max(
      ...(Array.isArray(performanceSeries) ? performanceSeries.flatMap(series => 
        (Array.isArray(series?.data) ? series.data.map(point => getMetricValue(point)) : [])
      ) : []),
      1
    );

    // Format value based on metric
    const formatValue = (value) => {
      if (metric === 'memory') {
        return (value / 1024 / 1024).toFixed(2) + 'MB';
      } else if (metric === 'cpu') {
        return value.toFixed(2) + '%';
      } else {
        return value.toFixed(2) + 's';
      }
    };

    const metricLabel = metric === 'memory' ? 'Memory (MB)' : metric === 'cpu' ? 'CPU (%)' : 'Duration (s)';
    
    // Format dates for labels
    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    
    // Generate colors for each transaction type
    const colors = [
      'var(--accent-primary)',
      'var(--error)',
      '#f59e0b',
      'var(--info)',
      '#9333ea',
      '#10b981',
      '#3b82f6'
    ];
    
    // Calculate points for each series
    const getPoints = (series) => {
      if (!series || !Array.isArray(series.data)) return [];
      return sortedTimestamps.map((timestamp, index) => {
        const point = series.data.find(p => p && p.timestamp === timestamp);
        const value = getMetricValue(point || {});
        const x = padding.left + (index / (sortedTimestamps.length - 1 || 1)) * chartAreaWidth;
        const y = padding.top + chartAreaHeight - (value / maxValue) * chartAreaHeight;
        return { x, y, value, hasData: !!point };
      });
    };
    
    const seriesPoints = Array.isArray(performanceSeries) ? performanceSeries.map(series => ({
      name: series?.name || 'Unknown',
      points: getPoints(series),
      color: colors[performanceSeries.indexOf(series) % colors.length]
    })) : [];
    
    // Create SVG path for line
    const createPath = (points) => {
      if (points.length === 0) return '';
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
      return path;
    };
    
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
          ⚡ Performance by Transaction Type - {metricLabel}
        </h3>
        <div style={{ position: 'relative', width: '100%', height: chartHeight, overflowX: 'auto' }}>
          <svg width={svgWidth} height={chartHeight} style={{ minWidth: '100%' }} viewBox={`0 0 ${svgWidth} ${chartHeight}`} preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((percent) => (
              <line
                key={percent}
                x1={padding.left}
                y1={padding.top + (percent / 100) * chartAreaHeight}
                x2={svgWidth - padding.right}
                y2={padding.top + (percent / 100) * chartAreaHeight}
                stroke="var(--border-primary)"
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.3"
              />
            ))}
            
            {/* Lines for each transaction type */}
            {seriesPoints.map((series, seriesIndex) => (
              <path
                key={seriesIndex}
                d={createPath(series.points)}
                fill="none"
                stroke={series.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            
            {/* Data points */}
            {seriesPoints.map((series, seriesIndex) => (
              <g key={`points-${seriesIndex}`}>
                {series.points.filter(p => p.hasData).map((point, i) => (
                  <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill={series.color}
                  />
                ))}
              </g>
            ))}
            
            {/* X-axis labels */}
            {sortedTimestamps.map((timestamp, i) => {
              const x = padding.left + (i / (sortedTimestamps.length - 1 || 1)) * chartAreaWidth;
              return (
                <text
                  key={i}
                  x={x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--text-secondary)"
                >
                  {formatDate(timestamp)}
                </text>
              );
            })}
            
            {/* Y-axis labels */}
            {[0, 1, 2, 3, 4].map((i) => {
              const value = (maxValue / 4) * i;
              const y = padding.top + chartAreaHeight - (i / 4) * chartAreaHeight;
              return (
                <text
                  key={i}
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-secondary)"
                >
                  {formatValue(value)}
                </text>
              );
            })}
          </svg>
        </div>
        
        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          gap: 'var(--space-4)', 
          marginTop: 'var(--space-3)',
          flexWrap: 'wrap',
          fontSize: 'var(--font-xs)'
        }}>
          {seriesPoints.map((series, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '2px', background: series.color }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>{series.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Filter performance series based on selected endpoint
  const filteredPerformanceSeries = Array.isArray(performanceSeries) 
    ? (selectedEndpoint === 'all' 
        ? performanceSeries 
        : performanceSeries.filter(series => series && series.name === selectedEndpoint))
    : [];

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
        <div className={styles.headerContent}>
          <h1 className={styles.logo}>
            <span className={styles.logoIcon}>⚡</span>
            Performance Analytics
          </h1>
          <div className={styles.headerActions}>
            <Link href="/dashboard">
              <button className={styles.headerButton}>
                📊 Dashboard
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.main}>
        {!sidebarCollapsed && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarHeader}>
                <div className={styles.sidebarTitleContainer}>
                  <button
                    onClick={() => setProjectsCollapsed(!projectsCollapsed)}
                    className={styles.collapseButton}
                    title={projectsCollapsed ? 'Expand projects' : 'Collapse projects'}
                  >
                    <span 
                      className={styles.collapseIcon}
                      style={{
                        transform: projectsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                      }}
                    >
                      ▼
                    </span>
                  </button>
                  <h3 className={styles.sidebarTitle}>Projects</h3>
                </div>
              </div>
              {!projectsCollapsed && (
                <div className={styles.projectsList}>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className={`${styles.projectItem} ${selectedProject === null ? styles.projectItemActive : ''}`}
                  >
                    <span>All Projects</span>
                  </button>
                  {projects.map(project => (
                    <div key={project.id} className={styles.projectItemContainer}>
                      <button
                        onClick={() => setSelectedProject(project.id)}
                        className={`${styles.projectItem} ${selectedProject === project.id ? styles.projectItemActive : ''}`}
                      >
                        <span>{project.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filters Section */}
            <div className={styles.sidebarSection} style={{ marginTop: 'var(--space-4)' }}>
              <div className={styles.sidebarHeader}>
                <h3 className={styles.sidebarTitle}>Filters</h3>
              </div>
              <div className={styles.projectsList}>
                <div style={{ padding: 'var(--space-2)' }}>
                  <label style={{ 
                    fontSize: 'var(--font-xs)', 
                    color: 'var(--text-secondary)', 
                    marginBottom: 'var(--space-1)',
                    display: 'block'
                  }}>
                    Endpoint
                  </label>
                  <select
                    value={selectedEndpoint}
                    onChange={(e) => setSelectedEndpoint(e.target.value)}
                    className={styles.filterSelect}
                    style={{ width: '100%', marginBottom: 'var(--space-3)' }}
                  >
                    <option value="all">All Endpoints</option>
                    {Array.isArray(availableEndpoints) && availableEndpoints.map(endpoint => (
                      <option key={endpoint} value={endpoint}>{endpoint}</option>
                    ))}
                  </select>

                  <label style={{ 
                    fontSize: 'var(--font-xs)', 
                    color: 'var(--text-secondary)', 
                    marginBottom: 'var(--space-1)',
                    display: 'block'
                  }}>
                    Metric
                  </label>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    className={styles.filterSelect}
                    style={{ width: '100%' }}
                  >
                    <option value="duration">Duration</option>
                    <option value="memory">Memory</option>
                    <option value="cpu">CPU</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>
        )}

        <div className={styles.contentWrapper}>
          {/* Sidebar toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={styles.sidebarToggle}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            <span style={{
              transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              display: 'inline-block',
              transition: 'transform 0.3s ease'
            }}>
              ◀
            </span>
          </button>

          <div className={styles.content}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
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
                {/* Performance Line Chart by Transaction Type */}
                {Array.isArray(filteredPerformanceSeries) && renderLineChart(filteredPerformanceSeries, selectedMetric)}
                
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
                  {Array.isArray(analytics.transactionDurations) && analytics.transactionDurations.length > 0 && (
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

                  {Array.isArray(analytics.memoryTimeline) && analytics.memoryTimeline.length > 0 && (
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

                  {Array.isArray(analytics.cpuTimeline) && analytics.cpuTimeline.length > 0 && (
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

                  {Array.isArray(analytics.eventLoopTimeline) && analytics.eventLoopTimeline.length > 0 && (
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
        </div>
      </div>
    </div>
  );
}

