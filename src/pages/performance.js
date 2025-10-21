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

