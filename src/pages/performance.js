import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import styles from '@/styles/Dashboard.module.css';

// Dynamically import charts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function PerformancePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchTransactions();
    }
  }, [selectedProject]);

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

  if (loading && !analytics) {
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

  // Prepare chart data
  const memoryChartOptions = {
    chart: {
      type: 'line',
      height: 350,
      toolbar: { show: true },
      animations: { enabled: true }
    },
    colors: ['#00E396', '#008FFB', '#FEB019'],
    stroke: {
      curve: 'smooth',
      width: 2
    },
    xaxis: {
      categories: analytics?.memoryTimeline?.map((_, i) => `T${i + 1}`) || [],
      title: { text: 'Transaction' }
    },
    yaxis: {
      title: { text: 'Memory (MB)' },
      labels: {
        formatter: (val) => val ? val.toFixed(2) : '0'
      }
    },
    legend: {
      position: 'top'
    },
    tooltip: {
      shared: true,
      intersect: false
    }
  };

  const memoryChartSeries = [
    {
      name: 'Heap Used',
      data: analytics?.memoryTimeline?.map(m => m.heapUsed / 1024 / 1024) || []
    },
    {
      name: 'Heap Total',
      data: analytics?.memoryTimeline?.map(m => m.heapTotal / 1024 / 1024) || []
    },
    {
      name: 'RSS',
      data: analytics?.memoryTimeline?.map(m => m.rss / 1024 / 1024) || []
    }
  ];

  const durationChartOptions = {
    chart: {
      type: 'bar',
      height: 350,
      toolbar: { show: true }
    },
    colors: ['#546E7A'],
    plotOptions: {
      bar: {
        borderRadius: 4,
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => formatDuration(val),
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#304758']
      }
    },
    xaxis: {
      categories: analytics?.transactionDurations?.map((_, i) => `T${i + 1}`) || [],
      title: { text: 'Transaction' }
    },
    yaxis: {
      title: { text: 'Duration (seconds)' },
      labels: {
        formatter: (val) => val ? val.toFixed(3) : '0'
      }
    }
  };

  const durationChartSeries = [{
    name: 'Duration',
    data: analytics?.transactionDurations || []
  }];

  const cpuChartOptions = {
    chart: {
      type: 'area',
      height: 350,
      toolbar: { show: true }
    },
    colors: ['#FF4560'],
    stroke: {
      curve: 'smooth',
      width: 2
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3
      }
    },
    xaxis: {
      categories: analytics?.cpuTimeline?.map((_, i) => `T${i + 1}`) || [],
      title: { text: 'Transaction' }
    },
    yaxis: {
      title: { text: 'CPU Usage (%)' },
      labels: {
        formatter: (val) => val ? val.toFixed(2) : '0'
      }
    }
  };

  const cpuChartSeries = [{
    name: 'CPU %',
    data: analytics?.cpuTimeline || []
  }];

  const eventLoopChartOptions = {
    chart: {
      type: 'line',
      height: 350,
      toolbar: { show: true }
    },
    colors: ['#775DD0'],
    stroke: {
      curve: 'smooth',
      width: 3
    },
    xaxis: {
      categories: analytics?.eventLoopTimeline?.map((_, i) => `T${i + 1}`) || [],
      title: { text: 'Transaction' }
    },
    yaxis: {
      title: { text: 'Event Loop Lag (ms)' },
      labels: {
        formatter: (val) => val ? val.toFixed(2) : '0'
      }
    },
    markers: {
      size: 5
    }
  };

  const eventLoopChartSeries = [{
    name: 'Lag (ms)',
    data: analytics?.eventLoopTimeline || []
  }];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📊 Performance Analytics</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
          <button
            onClick={fetchTransactions}
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

      {analytics && (
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
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h2 style={{ marginTop: 0 }}>Transaction Duration Over Time</h2>
              {typeof window !== 'undefined' && (
                <Chart
                  options={durationChartOptions}
                  series={durationChartSeries}
                  type="bar"
                  height={350}
                />
              )}
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h2 style={{ marginTop: 0 }}>Memory Usage Timeline</h2>
              {typeof window !== 'undefined' && (
                <Chart
                  options={memoryChartOptions}
                  series={memoryChartSeries}
                  type="line"
                  height={350}
                />
              )}
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h2 style={{ marginTop: 0 }}>CPU Usage Over Time</h2>
              {typeof window !== 'undefined' && (
                <Chart
                  options={cpuChartOptions}
                  series={cpuChartSeries}
                  type="area"
                  height={350}
                />
              )}
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ marginTop: 0 }}>Event Loop Lag</h2>
              {typeof window !== 'undefined' && (
                <Chart
                  options={eventLoopChartOptions}
                  series={eventLoopChartSeries}
                  type="line"
                  height={350}
                />
              )}
            </div>
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
                    const cpu = data.breadcrumbs?.find(b => b.message?.includes('CPU usage'))?.message?.match(/[\d.]+/)?.[0] || 'N/A';
                    
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

      {!analytics && !loading && (
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

