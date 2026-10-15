import shell from '@/styles/AppShell.module.css';

/** Project name plus the endpoint, source, page-URL and metric filters. */
export default function PerformanceSidebar({
  projects, selectedProject, selectedEndpoint, setSelectedEndpoint, availableEndpoints, origins, originFilter,
  setOriginFilter, pageUrlFilter, setPageUrlFilter, selectedMetric, setSelectedMetric,
}) {
  return (
    <aside className={shell.sidebar}>
      <div className={shell.sidebarSection}>
        <div className={shell.sidebarHeader}>
          <h3 className={shell.sidebarTitle}>Current Project</h3>
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
      <div className={shell.sidebarSection} style={{ marginTop: 'var(--space-2)' }}>
        <div className={shell.sidebarHeader}>
          <h3 className={shell.sidebarTitle}>Filters</h3>
        </div>
        <div className={shell.projectsList}>
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
              className={shell.filterSelect}
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
            >
              <option value="all">All Endpoints</option>
              {Array.isArray(availableEndpoints) && availableEndpoints.map(endpoint => (
                <option key={endpoint} value={endpoint}>{endpoint}</option>
              ))}
            </select>

            {(origins.length > 1 || originFilter !== 'all') && (
              <>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
                  From
                </label>
                <select
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value)}
                  className={shell.filterSelect}
                  style={{ width: '100%', marginBottom: 'var(--space-3)' }}
                  aria-label="Source host"
                >
                  <option value="all">All sources</option>
                  {origins.map((o) => <option key={o.origin} value={o.origin}>{o.origin} ({o.count})</option>)}
                  {originFilter !== 'all' && !origins.some((o) => o.origin === originFilter) && <option value={originFilter}>{originFilter}</option>}
                </select>
              </>
            )}

            <label style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-1)',
              display: 'block'
            }}>
              Page URL facet
            </label>
            <input
              type="text"
              value={pageUrlFilter}
              onChange={(e) => setPageUrlFilter(e.target.value)}
              placeholder="/checkout or substring"
              style={{
                width: '100%',
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-primary)',
                fontSize: 'var(--font-sm)',
                boxSizing: 'border-box'
              }}
            />

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
              className={shell.filterSelect}
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
  );
}
