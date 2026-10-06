import Link from 'next/link';
import Icon from '@/components/Icon';
import shell from '@/styles/AppShell.module.css';
import styles from '@/styles/Dashboard.module.css';

export default function FilterSidebar({ selectedProject, projects, filterStatus, setFilterStatus, filterLevel, setFilterLevel, refreshInterval, setRefreshInterval, desktopAlerts, onToggleDesktopAlerts, onExport, onShowShortcuts }) {
  return (
    <aside className={shell.sidebar}>
      <div className={shell.sidebarSection}>
        <div className={shell.sidebarHeader}>
          <h3 className={shell.sidebarTitle}>Current View</h3>
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
            <Icon name={selectedProject ? 'inbox' : 'dashboard'} size={16} />
            {selectedProject ? projects.find(p => p.id === selectedProject)?.name : 'All Projects'}
          </div>
        </div>
        {selectedProject && (
          <div style={{ padding: '0 var(--space-4) var(--space-2)' }}>
            <Link 
              href={`/project/${selectedProject}`}
              className={styles.projectSettingsButton}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Icon name="settings" size={14} /> Project Settings
            </Link>
          </div>
        )}
      </div>

      <div className={shell.sidebarSection}>
        <div className={shell.sidebarHeader}>
          <h3 className={shell.sidebarTitle}>Issues</h3>
        </div>
        <div className={shell.projectsList}>
          <button
            onClick={() => setFilterStatus('all')}
            className={`${styles.projectItem} ${filterStatus === 'all' ? styles.projectItemActive : ''}`}
          >
            <span>All Issues</span>
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`${styles.projectItem} ${filterStatus === 'active' ? styles.projectItemActive : ''}`}
          >
            <span>Active</span>
          </button>
          <button
            onClick={() => setFilterStatus('resolved')}
            className={`${styles.projectItem} ${filterStatus === 'resolved' ? styles.projectItemActive : ''}`}
          >
            <span>Resolved</span>
          </button>
          <button
            onClick={() => setFilterStatus('ignored')}
            className={`${styles.projectItem} ${filterStatus === 'ignored' ? styles.projectItemActive : ''}`}
          >
            <span>Ignored</span>
          </button>
        </div>
      </div>

      <div className={shell.sidebarSection}>
        <div className={shell.sidebarHeader}>
          <h3 className={shell.sidebarTitle}>Level</h3>
        </div>
        <div className={shell.projectsList}>
          <button
            onClick={() => setFilterLevel('all')}
            className={`${styles.projectItem} ${filterLevel === 'all' ? styles.projectItemActive : ''}`}
          >
            <span>All Levels</span>
          </button>
          <button
            onClick={() => setFilterLevel('error')}
            className={`${styles.projectItem} ${filterLevel === 'error' ? styles.projectItemActive : ''}`}
          >
            <span className={styles.levelDot} style={{ backgroundColor: 'var(--error)' }}></span>
            <span>Error</span>
          </button>
          <button
            onClick={() => setFilterLevel('warning')}
            className={`${styles.projectItem} ${filterLevel === 'warning' ? styles.projectItemActive : ''}`}
          >
            <span className={styles.levelDot} style={{ backgroundColor: 'var(--warning)' }}></span>
            <span>Warning</span>
          </button>
          <button
            onClick={() => setFilterLevel('info')}
            className={`${styles.projectItem} ${filterLevel === 'info' ? styles.projectItemActive : ''}`}
          >
            <span className={styles.levelDot} style={{ backgroundColor: 'var(--info)' }}></span>
            <span>Info</span>
          </button>
        </div>
      </div>

      <div className={shell.sidebarSection}>
        <div className={shell.sidebarHeader}>
          <h3 className={shell.sidebarTitle}>Tools</h3>
        </div>
        <div className={shell.projectsList}>
          <label className={styles.sidebarField}>
            <span>Refresh every</span>
            <select
              className={shell.filterSelect}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
            >
              <option value={5000}>5 seconds</option>
              <option value={15000}>15 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
            </select>
          </label>
          <button onClick={onToggleDesktopAlerts} className={`${styles.projectItem} ${desktopAlerts ? styles.projectItemActive : ''}`}>
            <span className={styles.iconLabel}><Icon name="bell" size={14} /> Desktop alerts {desktopAlerts ? 'on' : 'off'}</span>
          </button>
          <button onClick={() => onExport('csv')} className={styles.projectItem}>
            <span className={styles.iconLabel}><Icon name="download" size={14} /> Export CSV</span>
          </button>
          <button onClick={() => onExport('json')} className={styles.projectItem}>
            <span className={styles.iconLabel}><Icon name="download" size={14} /> Export JSON</span>
          </button>
          <button onClick={() => onShowShortcuts()} className={styles.projectItem}>
            <span className={styles.iconLabel}><Icon name="keyboard" size={14} /> Keyboard shortcuts</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
