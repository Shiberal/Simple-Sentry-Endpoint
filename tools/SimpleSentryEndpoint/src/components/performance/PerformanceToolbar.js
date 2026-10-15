/** View-mode switch, time-series range controls and a refresh button. */
export default function PerformanceToolbar({
  viewMode, setViewMode, timeRange, setTimeRange, interval, setAggregationInterval,
  customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, onRefresh,
}) {
  return (
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
          onChange={(e) => setAggregationInterval(e.target.value)}
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
      onClick={onRefresh}
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
  );
}
