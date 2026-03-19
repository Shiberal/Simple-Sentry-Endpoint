import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
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
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshFnRef = useRef(null);
  const selectedProjectRef = useRef(selectedProject);
  selectedProjectRef.current = selectedProject;

  // Helper to get CSS variable value for SVG (some browsers need computed values)
  const getCSSVariable = (varName) => {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }
    return '';
  };

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

  useEffect(() => {
    // Update the ref whenever the fetch functions or viewMode change
    refreshFnRef.current = viewMode === 'timeseries'
      ? (id) => fetchTimeSeries(id)
      : (id) => fetchTransactions(id);
  }, [viewMode, timeRange, interval, customStartDate, customEndDate]);

  useEffect(() => {
    if (!autoRefresh || selectedProject == null) return;
    
    const refreshIntervalMs = 5000;
    const id = setInterval(() => {
      const projectId = selectedProjectRef.current;
      if (projectId == null) return;
      
      const fn = refreshFnRef.current;
      if (fn) {
        console.log(`[AutoRefresh] Triggering refresh for project ${projectId} in ${viewMode} mode`);
        fn(projectId);
      }
    }, refreshIntervalMs);
    
    return () => clearInterval(id);
  }, [autoRefresh, selectedProject == null, viewMode]); // Only restart if autoRefresh, project presence, or viewMode changes

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      const projectsList = data.projects || [];
      setProjects(projectsList);
      if (projectsList.length > 0 && selectedProject === null) {
        setSelectedProject(projectsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchTransactions = async (optionalProjectId) => {
    let projectId = optionalProjectId !== undefined ? optionalProjectId : selectedProject;
    
    // Safety check for [object Object] or other invalid IDs
    if (typeof projectId === 'object' && projectId !== null) {
      console.warn('[fetchTransactions] Received object as projectId, attempting to extract id', projectId);
      projectId = projectId.id || null;
    }

    if (projectId === null || projectId === undefined || projectId === '[object Object]') {
      setTransactions([]);
      setAnalytics(null);
      setPerformanceSeries([]);
      setAvailableEndpoints([]);
      setLoading(false);
      return;
    }

    const isBackgroundRefresh = optionalProjectId !== undefined;
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    setError(null);
    try {
      console.log(`[fetchTransactions] Fetching for project ${projectId}`);
      const response = await fetch(`/api/analytics/performance?projectId=${projectId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`[fetchTransactions] Received ${data.transactions?.length || 0} transactions`);
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
          
          // Calculate duration - Sentry timestamps are in seconds
          let duration = 0;
          if (timestamp && startTimestamp && typeof timestamp === 'number' && typeof startTimestamp === 'number') {
            // Sentry uses Unix timestamps in seconds
            duration = timestamp - startTimestamp;
          }
          
          // Extract memory from Sentry contexts (preferred)
          let memory = 0;
          if (transaction.data?.contexts?.app?.app_memory) {
            const appMemory = transaction.data.contexts.app.app_memory;
            // If it's a large number (> 1GB), assume bytes, otherwise assume MB
            memory = appMemory > 1024 * 1024 * 1024 ? appMemory : appMemory * 1024 * 1024;
          } else if (transaction.data?.contexts?.device?.memory_size) {
            memory = transaction.data.contexts.device.memory_size * 1024 * 1024;
          } else {
            // Fallback to old method
            memory = transaction.data?.contexts?.device?.app_memory || 0;
          }
          
          // Extract CPU from contexts (preferred) or breadcrumbs
          let cpu = 0;
          if (transaction.data?.contexts?.device?.cpu_percent !== undefined) {
            cpu = transaction.data.contexts.device.cpu_percent;
          } else if (transaction.data?.contexts?.runtime?.cpu_percent !== undefined) {
            cpu = transaction.data.contexts.runtime.cpu_percent;
          } else {
            // Fallback to breadcrumbs
            const breadcrumbs = Array.isArray(transaction.data?.breadcrumbs) 
              ? transaction.data.breadcrumbs 
              : transaction.data?.breadcrumbs?.values || [];
            const cpuBreadcrumb = breadcrumbs.find(b => 
              b.message && b.message.includes('CPU usage')
            );
            if (cpuBreadcrumb) {
              const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
              if (cpuMatch) {
                cpu = parseFloat(cpuMatch[1]);
              }
            }
          }
          
          // Extract event loop lag from breadcrumbs
          let eventLoopLag = 0;
          const breadcrumbs = Array.isArray(transaction.data?.breadcrumbs) 
            ? transaction.data.breadcrumbs 
            : transaction.data?.breadcrumbs?.values || [];
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
        data: points.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
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
      setError(error.message || 'Failed to load performance data');
      setTransactions([]);
      setAnalytics(null);
      setPerformanceSeries([]);
      setAvailableEndpoints([]);
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  };

  const fetchTimeSeries = async (optionalProjectId) => {
    let projectId = optionalProjectId !== undefined ? optionalProjectId : selectedProject;
    
    // Safety check for [object Object] or other invalid IDs
    if (typeof projectId === 'object' && projectId !== null) {
      console.warn('[fetchTimeSeries] Received object as projectId, attempting to extract id', projectId);
      projectId = projectId.id || null;
    }

    if (!projectId || projectId === '[object Object]') return;

    const isBackgroundRefresh = optionalProjectId !== undefined;
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
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
        projectId: String(projectId),
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
      if (!isBackgroundRefresh) setLoading(false);
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
  };

  const renderTimeSeriesChart = (series, metricKey, label, color, unit = '', formatFn = (v) => v.toFixed(2)) => {
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

    // Format value based on metric
    const formatValue = (value) => {
      if (metric === 'memory') {
        const mb = value / 1024 / 1024;
        if (mb >= 1024) {
          return (mb / 1024).toFixed(1) + 'GB';
        }
        return mb.toFixed(1) + 'MB';
      } else if (metric === 'cpu') {
        return value.toFixed(1) + '%';
      } else {
        // For duration, show more readable format
        if (value < 0.001) {
          return (value * 1000).toFixed(0) + 'ms';
        } else if (value < 1) {
          return (value * 1000).toFixed(0) + 'ms';
        } else if (value < 60) {
          return value.toFixed(2) + 's';
        } else {
          const mins = Math.floor(value / 60);
          const secs = (value % 60).toFixed(1);
          return `${mins}m ${secs}s`;
        }
      }
    };

    const metricLabel = metric === 'memory' ? 'Memory (MB)' : metric === 'cpu' ? 'CPU (%)' : 'Duration (s)';
    
    // Format dates for labels
    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };
    
    // Get all unique timestamps and sort them
    const allTimestamps = new Set();
    performanceSeries.forEach(series => {
      if (series && Array.isArray(series.data)) {
        series.data.forEach(point => {
          if (point && point.timestamp) {
            allTimestamps.add(point.timestamp);
          }
        });
      }
    });
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => new Date(b) - new Date(a));
    
    // Transform data for Recharts - create unified dataset
    const chartData = sortedTimestamps.map(timestamp => {
      const dataPoint = { date: formatDate(timestamp), timestamp };
      performanceSeries.forEach(series => {
        if (series && Array.isArray(series.data)) {
          const point = series.data.find(p => p && p.timestamp === timestamp);
          const seriesName = series.name || 'Unknown';
          dataPoint[seriesName] = point ? getMetricValue(point) : null;
        }
      });
      return dataPoint;
    });

    // If we have many points, only show labels for some to avoid overlap
    const interval = Math.ceil(chartData.length / 10);
    
    // Generate colors for each transaction type - theme-aware
    const colors = [
      getCSSVariable('--accent-primary') || '#3b82f6',
      getCSSVariable('--error') || '#ef4444',
      getCSSVariable('--warning') || '#f59e0b',
      getCSSVariable('--info') || '#06b6d4',
      getCSSVariable('--success') || '#10b981',
      getCSSVariable('--accent-primary') || '#3b82f6',
      getCSSVariable('--info') || '#06b6d4'
    ];
    
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
        <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
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
                interval={interval}
              />
              <YAxis 
                tick={{ fill: getCSSVariable('--text-secondary'), fontSize: 12 }}
                stroke={getCSSVariable('--border-primary')}
                tickFormatter={formatValue}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: getCSSVariable('--bg-primary'),
                  border: `1px solid ${getCSSVariable('--border-primary')}`,
                  borderRadius: getCSSVariable('--radius-sm'),
                  color: getCSSVariable('--text-primary')
                }}
                labelStyle={{ color: getCSSVariable('--text-primary') }}
                formatter={(value) => [value !== null ? formatValue(value) : 'N/A', '']}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              {performanceSeries.map((series, index) => {
                const seriesName = series?.name || 'Unknown';
                return (
                  <Line
                    key={seriesName}
                    type="monotone"
                    dataKey={seriesName}
                    stroke={colors[index % colors.length]}
                    strokeWidth={3}
                    dot={{ fill: colors[index % colors.length], r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
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
      {/* Left Navigation Sidebar */}
      <nav className={styles.navSidebar}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div 
            className={`${styles.navItem} ${router.pathname === '/dashboard' ? styles.navItemActive : ''}`}
            title="Global Dashboard"
          >
            📊
            <div className={styles.navItemTooltip}>Global Dashboard</div>
          </div>
        </Link>
        <Link href="/performance" style={{ textDecoration: 'none' }}>
          <div 
            className={`${styles.navItem} ${router.pathname === '/performance' ? styles.navItemActive : ''}`}
            title="Performance"
          >
            ⚡
            <div className={styles.navItemTooltip}>Performance</div>
          </div>
        </Link>
        
        <div className={styles.navDivider}></div>

        {/* Project Selector (Discord-like) */}
        {projects.map(project => (
          <div 
            key={project.id}
            className={`${styles.navProjectItem} ${selectedProject === project.id ? styles.navProjectItemActive : ''}`}
            onClick={() => setSelectedProject(project.id)}
            title={project.name}
          >
            {project.name.substring(0, 2).toUpperCase()}
            <div className={styles.navItemTooltip}>{project.name}</div>
          </div>
        ))}

        <div className={styles.navDivider}></div>

        <Link href="/profile" style={{ textDecoration: 'none' }}>
          <div 
            className={`${styles.navItem} ${router.pathname === '/profile' ? styles.navItemActive : ''}`}
            title="Profile"
          >
            👤
            <div className={styles.navItemTooltip}>Your Profile</div>
          </div>
        </Link>
      </nav>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.logo}>
              <span className={styles.logoIcon}>⚡</span>
              Performance Analytics
            </h1>
            <div className={styles.headerActions}>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={styles.headerButton}
                title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
              >
                {autoRefresh ? '●' : '○'} {autoRefresh ? 'Live' : 'Paused'}
              </button>
              <button 
                onClick={() => {
                  if (viewMode === 'timeseries') fetchTimeSeries();
                  else fetchTransactions();
                }}
                className={styles.headerButton}
                title="Refresh data"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarHeader}>
                <h3 className={styles.sidebarTitle}>Current Project</h3>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-4)' }}>
                <div style={{ 
                  background: 'var(--bg-tertiary)', 
                  padding: 'var(--space-2) var(--space-3)', 
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent-primary)',
                  fontWeight: 'var(--weight-bold)',
                  fontSize: 'var(--font-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  <span style={{ fontSize: '18px' }}>📁</span>
                  {projects.find(p => p.id === selectedProject)?.name || 'Select a project'}
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className={styles.sidebarSection} style={{ marginTop: 'var(--space-2)' }}>
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

        <div className={styles.contentWrapper} style={{ position: 'relative' }}>

          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: 'var(--space-4)',
            height: 'calc(100vh - 36px)'
          }}>
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-2)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              {/* View Mode Toggle */}
              <div style={{ 
                display: 'flex', 
                gap: '5px', 
                background: 'var(--bg-tertiary)', 
                borderRadius: 'var(--radius-sm)', 
                padding: '2px' 
              }}>
                <button
                  onClick={() => setViewMode('detailed')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: viewMode === 'detailed' ? 'var(--accent-primary)' : 'transparent',
                    color: viewMode === 'detailed' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-sm)',
                    fontWeight: viewMode === 'detailed' ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Detailed
                </button>
                <button
                  onClick={() => setViewMode('timeseries')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: viewMode === 'timeseries' ? 'var(--accent-primary)' : 'transparent',
                    color: viewMode === 'timeseries' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-sm)',
                    fontWeight: viewMode === 'timeseries' ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                    transition: 'all var(--transition-fast)'
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
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-primary)',
                    fontSize: 'var(--font-sm)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
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
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-primary)',
                        fontSize: 'var(--font-sm)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-primary)',
                        fontSize: 'var(--font-sm)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </>
                )}
                
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-primary)',
                    fontSize: 'var(--font-sm)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
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
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--accent-primary)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--weight-medium)',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--accent-hover)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--accent-primary)'}
            >
              Refresh
            </button>
            </div>

            {viewMode === 'timeseries' && timeSeriesData && (
        <>
          {/* Time Series View */}
          {timeSeriesData.series && Array.isArray(timeSeriesData.series) && timeSeriesData.series.length > 0 ? (
            <div style={{ marginBottom: '30px' }}>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
              }}>
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Total Intervals</h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                    {timeSeriesData.series.length}
                  </p>
                </div>
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Total Transactions</h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--success)' }}>
                    {timeSeriesData.series.reduce((sum, s) => sum + s.count, 0)}
                  </p>
                </div>
              </div>

              {/* Time Series Charts */}
              <div style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--space-4)'
              }}>
                <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Transaction Duration Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'avgDuration',
                  'Average Duration',
                  'var(--accent-primary)',
                  's',
                  (v) => formatDuration(v)
                )}
              </div>

              <div style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--space-4)'
              }}>
                <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Memory Usage Over Time</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                  {renderTimeSeriesChart(
                    timeSeriesData.series,
                    'avgMemoryHeap',
                    'Average Heap Used',
                    'var(--success)',
                    ' MB',
                    (v) => (v / 1024 / 1024).toFixed(2)
                  )}
                  {renderTimeSeriesChart(
                    timeSeriesData.series,
                    'avgMemoryRSS',
                    'Average RSS',
                    'var(--info)',
                    ' MB',
                    (v) => (v / 1024 / 1024).toFixed(2)
                  )}
                </div>
              </div>

              <div style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--space-4)'
              }}>
                <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>CPU Usage Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'avgCpu',
                  'Average CPU Usage',
                  'var(--error)',
                  '%',
                  (v) => v.toFixed(2)
                )}
              </div>

              <div style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--space-4)'
              }}>
                <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Event Loop Lag Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'avgEventLoopLag',
                  'Average Event Loop Lag',
                  'var(--info)',
                  ' ms',
                  (v) => v.toFixed(2)
                )}
              </div>

              <div style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--space-4)'
              }}>
                <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Transaction Count Over Time</h2>
                {renderTimeSeriesChart(
                  timeSeriesData.series,
                  'count',
                  'Transaction Count',
                  'var(--warning)',
                  '',
                  (v) => Math.round(v)
                )}
              </div>

              {/* Web Vitals Charts */}
              {(timeSeriesData.series.some(s => s.metrics?.avgFcp !== undefined) ||
                timeSeriesData.series.some(s => s.metrics?.avgLcp !== undefined) ||
                timeSeriesData.series.some(s => s.metrics?.avgFid !== undefined) ||
                timeSeriesData.series.some(s => s.metrics?.avgCls !== undefined) ||
                timeSeriesData.series.some(s => s.metrics?.avgTtfb !== undefined)) && (
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)',
                  marginBottom: 'var(--space-4)'
                }}>
                  <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Core Web Vitals</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    {timeSeriesData.series.some(s => s.metrics?.avgFcp !== undefined) && (
                      <div>
                        {renderTimeSeriesChart(
                          timeSeriesData.series,
                          'avgFcp',
                          'First Contentful Paint (FCP)',
                          'var(--accent-primary)',
                          'ms',
                          (v) => Math.round(v)
                        )}
                      </div>
                    )}
                    {timeSeriesData.series.some(s => s.metrics?.avgLcp !== undefined) && (
                      <div>
                        {renderTimeSeriesChart(
                          timeSeriesData.series,
                          'avgLcp',
                          'Largest Contentful Paint (LCP)',
                          'var(--success)',
                          'ms',
                          (v) => Math.round(v)
                        )}
                      </div>
                    )}
                    {timeSeriesData.series.some(s => s.metrics?.avgFid !== undefined) && (
                      <div>
                        {renderTimeSeriesChart(
                          timeSeriesData.series,
                          'avgFid',
                          'First Input Delay (FID)',
                          'var(--error)',
                          'ms',
                          (v) => Math.round(v)
                        )}
                      </div>
                    )}
                    {timeSeriesData.series.some(s => s.metrics?.avgCls !== undefined) && (
                      <div>
                        {renderTimeSeriesChart(
                          timeSeriesData.series,
                          'avgCls',
                          'Cumulative Layout Shift (CLS)',
                          'var(--info)',
                          '',
                          (v) => v.toFixed(3)
                        )}
                      </div>
                    )}
                    {timeSeriesData.series.some(s => s.metrics?.avgTtfb !== undefined) && (
                      <div>
                        {renderTimeSeriesChart(
                          timeSeriesData.series,
                          'avgTtfb',
                          'Time to First Byte (TTFB)',
                          'var(--warning)',
                          'ms',
                          (v) => Math.round(v)
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-primary)',
              padding: 'var(--space-12)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <p style={{ fontSize: 'var(--font-lg)', color: 'var(--text-secondary)' }}>No time series data available for the selected range.</p>
              <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>Try adjusting the time range or interval.</p>
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
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Total Transactions</h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                    {analytics.totalTransactions}
                  </p>
                </div>

                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Avg Duration</h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--success)' }}>
                    {formatDuration(analytics.avgDuration)}
                  </p>
                </div>

                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Avg Memory (Heap)</h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--warning)' }}>
                    {formatBytes(analytics.avgMemoryHeap)}
                  </p>
                </div>

                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Avg CPU Usage</h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--error)' }}>
                    {analytics.avgCpu ? analytics.avgCpu.toFixed(2) : '0'}%
                  </p>
                </div>
                </div>

                {/* Web Vitals Cards */}
                {analytics.webVitals && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '20px',
                    marginBottom: '30px'
                  }}>
                    {analytics.webVitals.avgFcp !== null && (
                      <div style={{
                        background: 'var(--bg-primary)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>FCP</h3>
                        <p style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                          {analytics.webVitals.avgFcp.toFixed(0)}ms
                        </p>
                        <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>First Contentful Paint</p>
                      </div>
                    )}
                    {analytics.webVitals.avgLcp !== null && (
                      <div style={{
                        background: 'var(--bg-primary)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>LCP</h3>
                        <p style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                          {analytics.webVitals.avgLcp.toFixed(0)}ms
                        </p>
                        <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Largest Contentful Paint</p>
                      </div>
                    )}
                    {analytics.webVitals.avgFid !== null && (
                      <div style={{
                        background: 'var(--bg-primary)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>FID</h3>
                        <p style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                          {analytics.webVitals.avgFid.toFixed(0)}ms
                        </p>
                        <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>First Input Delay</p>
                      </div>
                    )}
                    {analytics.webVitals.avgCls !== null && (
                      <div style={{
                        background: 'var(--bg-primary)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>CLS</h3>
                        <p style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                          {analytics.webVitals.avgCls.toFixed(3)}
                        </p>
                        <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Cumulative Layout Shift</p>
                      </div>
                    )}
                    {analytics.webVitals.avgTtfb !== null && (
                      <div style={{
                        background: 'var(--bg-primary)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>TTFB</h3>
                        <p style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                          {analytics.webVitals.avgTtfb.toFixed(0)}ms
                        </p>
                        <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Time to First Byte</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Charts */}
                <div style={{ marginBottom: '30px' }}>
                  {Array.isArray(analytics.transactionDurations) && analytics.transactionDurations.length > 0 && (
                    <div style={{
                      background: 'var(--bg-primary)',
                      padding: 'var(--space-5)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-primary)',
                      boxShadow: 'var(--shadow-sm)',
                      marginBottom: 'var(--space-5)'
                    }}>
                      <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Transaction Duration Over Time</h2>
                      {renderBarChart(
                        analytics.transactionDurations,
                        analytics.transactionNames || analytics.transactionDurations.map((unused, i) => `T${i + 1}`),
                        'var(--accent-primary)',
                        's'
                      )}
                    </div>
                  )}

                  {Array.isArray(analytics.memoryTimeline) && analytics.memoryTimeline.length > 0 && (
                    <div style={{
                      background: 'var(--bg-primary)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-primary)',
                      boxShadow: 'var(--shadow-sm)',
                      marginBottom: 'var(--space-4)'
                    }}>
                      <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Memory Usage Timeline</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                        <div>
                          <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Heap Used (MB)</h3>
                          {renderBarChart(
                            analytics.memoryTimeline.map(m => m.heapUsed / 1024 / 1024),
                            analytics.transactionNames || analytics.memoryTimeline.map((unused, i) => `T${i + 1}`),
                            'var(--success)',
                            ' MB'
                          )}
                        </div>
                        <div>
                          <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Heap Total (MB)</h3>
                          {renderBarChart(
                            analytics.memoryTimeline.map(m => m.heapTotal / 1024 / 1024),
                            analytics.transactionNames || analytics.memoryTimeline.map((unused, i) => `T${i + 1}`),
                            'var(--info)',
                            ' MB'
                          )}
                        </div>
                        <div>
                          <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>RSS (MB)</h3>
                          {renderBarChart(
                            analytics.memoryTimeline.map(m => m.rss / 1024 / 1024),
                            analytics.transactionNames || analytics.memoryTimeline.map((unused, i) => `T${i + 1}`),
                            'var(--warning)',
                            ' MB'
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {Array.isArray(analytics.cpuTimeline) && analytics.cpuTimeline.length > 0 && (
                    <div style={{
                      background: 'var(--bg-primary)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-primary)',
                      boxShadow: 'var(--shadow-sm)',
                      marginBottom: 'var(--space-4)'
                    }}>
                      <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>CPU Usage Over Time</h2>
                      {renderBarChart(
                        analytics.cpuTimeline,
                        analytics.transactionNames || analytics.cpuTimeline.map((unused, i) => `T${i + 1}`),
                        'var(--error)',
                        '%'
                      )}
                    </div>
                  )}

                  {Array.isArray(analytics.eventLoopTimeline) && analytics.eventLoopTimeline.length > 0 && (
                    <div style={{
                      background: 'var(--bg-primary)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-primary)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Event Loop Lag</h2>
                      {renderBarChart(
                        analytics.eventLoopTimeline,
                        analytics.transactionNames || analytics.eventLoopTimeline.map((unused, i) => `T${i + 1}`),
                        'var(--info)',
                        ' ms'
                      )}
                    </div>
                  )}
                </div>

                {/* Transaction List */}
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>Recent Transactions</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                          <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', fontWeight: 'var(--weight-semibold)' }}>Transaction</th>
                          <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', fontWeight: 'var(--weight-semibold)' }}>Duration</th>
                          <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', fontWeight: 'var(--weight-semibold)' }}>Memory</th>
                          <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', fontWeight: 'var(--weight-semibold)' }}>CPU</th>
                          <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', fontWeight: 'var(--weight-semibold)' }}>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((transaction, index) => {
                          const data = transaction.data;
                          
                          // Sentry timestamps are in seconds (Unix timestamp)
                          const timestamp = data.timestamp;
                          const startTimestamp = data.start_timestamp;
                          
                          // Calculate duration in seconds (Sentry format)
                          let duration = 0;
                          if (timestamp && startTimestamp && typeof timestamp === 'number' && typeof startTimestamp === 'number') {
                            duration = timestamp - startTimestamp;
                          }
                          
                          // Extract memory from Sentry contexts (preferred) or fallback
                          let memory = 0;
                          if (data.contexts?.app?.app_memory) {
                            const appMemory = data.contexts.app.app_memory;
                            // If it's a large number (> 1GB), assume bytes, otherwise assume MB
                            memory = appMemory > 1024 * 1024 * 1024 ? appMemory : appMemory * 1024 * 1024;
                          } else if (data.contexts?.device?.memory_size) {
                            memory = data.contexts.device.memory_size * 1024 * 1024;
                          } else {
                            // Fallback to old method
                            memory = data.contexts?.device?.app_memory || 0;
                          }
                          
                          // Extract CPU from contexts or breadcrumbs
                          let cpu = 'N/A';
                          if (data.contexts?.device?.cpu_percent !== undefined) {
                            cpu = data.contexts.device.cpu_percent.toFixed(1);
                          } else if (data.contexts?.runtime?.cpu_percent !== undefined) {
                            cpu = data.contexts.runtime.cpu_percent.toFixed(1);
                          } else {
                            // Fallback to breadcrumbs
                            const breadcrumbs = Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs?.values || [];
                            const cpuBreadcrumb = breadcrumbs.find(b => b.message?.includes('CPU usage'));
                            if (cpuBreadcrumb) {
                              const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
                              if (cpuMatch) {
                                cpu = parseFloat(cpuMatch[1]).toFixed(1);
                              }
                            }
                          }
                          
                          // Format timestamp for display - Sentry uses seconds
                          let displayTimestamp;
                          if (timestamp && typeof timestamp === 'number') {
                            // Sentry timestamp is in seconds, convert to Date
                            displayTimestamp = new Date(timestamp * 1000);
                          } else {
                            displayTimestamp = new Date(transaction.createdAt);
                          }
                          
                          return (
                            <tr key={transaction.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                              <td style={{ padding: 'var(--space-3)', color: 'var(--text-primary)' }}>{data.transaction || 'Unnamed'}</td>
                              <td style={{ padding: 'var(--space-3)', color: 'var(--text-primary)' }}>{formatDuration(duration)}</td>
                              <td style={{ padding: 'var(--space-3)', color: 'var(--text-primary)' }}>{formatBytes(memory)}</td>
                              <td style={{ padding: 'var(--space-3)', color: 'var(--text-primary)' }}>{cpu}%</td>
                              <td style={{ padding: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
                                {displayTimestamp.toLocaleString()}
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

            {error && (
              <div style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                border: '1px solid var(--error)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--space-4)'
              }}>
                <p style={{ fontSize: 'var(--font-base)', color: 'var(--error)' }}>Error: {error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    if (selectedProject) {
                      fetchTransactions();
                    }
                  }}
                  style={{
                    marginTop: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'var(--accent-primary)',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {viewMode === 'detailed' && !analytics && !loading && !error && (
              <div style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-12)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {selectedProject === null || selectedProject === undefined ? (
                  <>
                    <p style={{ fontSize: 'var(--font-lg)', color: 'var(--text-secondary)' }}>Please select a project to view performance data.</p>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>Choose a project from the sidebar to get started.</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 'var(--font-lg)', color: 'var(--text-secondary)' }}>No transaction data available yet.</p>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>Send some transaction events to see performance analytics.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

