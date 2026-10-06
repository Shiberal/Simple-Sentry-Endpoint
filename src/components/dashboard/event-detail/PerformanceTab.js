import styles from '@/styles/Dashboard.module.css';

export default function PerformanceTab({ data }) {
  // Extract performance metrics
  const duration = data.timestamp && data.start_timestamp 
    ? (data.timestamp - data.start_timestamp) 
    : 0;

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0ms';
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    return `${seconds.toFixed(3)}s`;
  };

  // Extract metrics from breadcrumbs
  const metrics = {};
  if (data.breadcrumbs) {
    const breadcrumbs = data.breadcrumbs.values || data.breadcrumbs;
    if (Array.isArray(breadcrumbs)) {
      breadcrumbs.forEach(bc => {
        const msg = bc.message || '';

        // Memory metrics
        if (msg.includes('Heap Used:')) {
          const match = msg.match(/([\d.]+)\s*MB/);
          if (match) metrics.heapUsed = parseFloat(match[1]);
        }
        if (msg.includes('Heap Total:')) {
          const match = msg.match(/([\d.]+)\s*MB/);
          if (match) metrics.heapTotal = parseFloat(match[1]);
        }
        if (msg.includes('RSS:')) {
          const match = msg.match(/([\d.]+)\s*MB/);
          if (match) metrics.rss = parseFloat(match[1]);
        }

        // Performance metrics
        if (msg.includes('CPU usage:')) {
          const match = msg.match(/([\d.]+)%/);
          if (match) metrics.cpu = parseFloat(match[1]);
        }
        if (msg.includes('event loop lag:')) {
          const match = msg.match(/([\d.]+)\s*ms/);
          if (match) metrics.eventLoopLag = parseFloat(match[1]);
        }
        if (msg.includes('active connections:')) {
          const match = msg.match(/:\s*(\d+)/);
          if (match) metrics.activeConnections = parseInt(match[1]);
        }
        if (msg.includes('throughput:')) {
          const match = msg.match(/([\d.]+)\s*req\/s/);
          if (match) metrics.throughput = parseFloat(match[1]);
        }
      });
    }
  }

  // Get memory from contexts
  const appMemory = data.contexts?.app?.app_memory;

  const renderMetricCard = (label, value, color = '#3b82f6') => (
    <div style={{
      background: 'var(--bg-secondary)',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid var(--border-primary)'
    }}>
      <div style={{
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: color
      }}>
        {value}
      </div>
    </div>
  );

  const renderBarChart = (label, value, max, color, unit = '') => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
          fontSize: '13px'
        }}>
          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{value.toFixed(2)}{unit}</span>
        </div>
        <div style={{
          width: '100%',
          height: '20px',
          background: 'var(--bg-tertiary)',
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
  };

  return (
    <>
      {/* Transaction Info */}
      <div className={styles.detailSection}>
        <h4 className={styles.detailSectionTitle}>Transaction Overview</h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {renderMetricCard('Duration', formatDuration(duration), '#8b5cf6')}
          {data.transaction && renderMetricCard('Transaction', data.transaction, '#3b82f6')}
          {data.contexts?.trace?.status && renderMetricCard('Status', data.contexts.trace.status.toUpperCase(), '#10b981')}
          {data.environment && renderMetricCard('Environment', data.environment, '#f59e0b')}
        </div>
      </div>

      {/* Memory Metrics */}
      {(metrics.heapUsed || metrics.heapTotal || metrics.rss || appMemory) && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailSectionTitle}>Memory Metrics</h4>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border-primary)'
          }}>
            {metrics.heapUsed && metrics.heapTotal && (
              <>
                {renderBarChart('Heap Used', metrics.heapUsed, metrics.heapTotal, 'linear-gradient(90deg, #00E396 0%, #00A875 100%)', ' MB')}
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px'
                }}>
                  Heap Utilization: {((metrics.heapUsed / metrics.heapTotal) * 100).toFixed(1)}%
                </div>
              </>
            )}
            {metrics.rss && (
              renderBarChart('RSS Memory', metrics.rss, metrics.rss * 1.2, 'linear-gradient(90deg, #FEB019 0%, #FF6B6B 100%)', ' MB')
            )}
            {appMemory && (
              renderBarChart('App Memory', appMemory / 1024 / 1024, (appMemory / 1024 / 1024) * 1.2, 'linear-gradient(90deg, #008FFB 0%, #00E396 100%)', ' MB')
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-primary)'
            }}>
              {metrics.heapUsed && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Used</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapUsed.toFixed(2)} MB</div>
                </div>
              )}
              {metrics.heapTotal && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Total</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapTotal.toFixed(2)} MB</div>
                </div>
              )}
              {metrics.rss && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>RSS</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.rss.toFixed(2)} MB</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Metrics */}
      {(metrics.cpu !== undefined || metrics.eventLoopLag || metrics.activeConnections) && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailSectionTitle}>System Performance</h4>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border-primary)'
          }}>
            {metrics.cpu !== undefined && (
              <>
                {renderBarChart('CPU Usage', metrics.cpu, 100, 'linear-gradient(90deg, #FF4560 0%, #FF6B6B 100%)', '%')}
                <div style={{
                  fontSize: '12px',
                  color: metrics.cpu < 1 ? '#10b981' : metrics.cpu < 50 ? '#f59e0b' : '#ef4444',
                  marginBottom: '12px',
                  fontWeight: '500'
                }}>
                  {metrics.cpu < 1 ? 'Excellent (very low)' : metrics.cpu < 50 ? 'Moderate' : 'High: needs attention'}
                </div>
              </>
            )}
            {metrics.eventLoopLag && (
              <>
                {renderBarChart('Event Loop Lag', metrics.eventLoopLag, 10, 'linear-gradient(90deg, #775DD0 0%, #9B7FE8 100%)', ' ms')}
                <div style={{
                  fontSize: '12px',
                  color: metrics.eventLoopLag < 10 ? '#10b981' : metrics.eventLoopLag < 50 ? '#f59e0b' : '#ef4444',
                  marginBottom: '12px',
                  fontWeight: '500'
                }}>
                  {metrics.eventLoopLag < 10 ? 'Healthy (< 10ms)' : metrics.eventLoopLag < 50 ? 'Moderate' : 'High latency'}
                </div>
              </>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-primary)'
            }}>
              {metrics.cpu !== undefined && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU Usage</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.cpu.toFixed(2)}%</div>
                </div>
              )}
              {metrics.eventLoopLag && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Event Loop Lag</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.eventLoopLag.toFixed(2)} ms</div>
                </div>
              )}
              {metrics.activeConnections && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Active Connections</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.activeConnections}</div>
                </div>
              )}
              {metrics.throughput && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Throughput</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.throughput.toFixed(2)} req/s</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Device Info */}
      {data.contexts?.device && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailSectionTitle}>Device Information</h4>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--border-primary)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            {data.contexts.device.cpu_description && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.cpu_description}</div>
              </div>
            )}
            {data.contexts.device.processor_count && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Cores</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.processor_count}</div>
              </div>
            )}
            {data.contexts.device.memory_size && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Memory</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.memory_size)}</div>
              </div>
            )}
            {data.contexts.device.free_memory && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Free Memory</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.free_memory)}</div>
              </div>
            )}
            {data.contexts.device.arch && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Architecture</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.arch}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      <div className={styles.detailSection}>
        <h4 className={styles.detailSectionTitle}>Performance Summary</h4>
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid var(--border-primary)'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: 'var(--text-primary)'
          }}>
            Overall Assessment
          </div>
          <div style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'var(--text-secondary)'
          }}>
            {metrics.cpu !== undefined && metrics.eventLoopLag ? (
              metrics.cpu < 1 && metrics.eventLoopLag < 10 ? (
                <div style={{ color: '#10b981', fontWeight: '600' }}>
                  Excellent: system is performing optimally
                </div>
              ) : metrics.cpu < 5 && metrics.eventLoopLag < 50 ? (
                <div style={{ color: '#f59e0b', fontWeight: '600' }}>
                  Good: system is performing well
                </div>
              ) : (
                <div style={{ color: '#ef4444', fontWeight: '600' }}>
                  Needs attention: consider optimization
                </div>
              )
            ) : (
              <div>Performance metrics available. Review individual sections above for details.</div>
            )}
          </div>
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-primary)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Transaction Duration</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{formatDuration(duration)}</div>
            </div>
            {data.spans && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spans</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.spans.length}</div>
              </div>
            )}
            {data.server_name && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Server</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.server_name}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
