import styles from '@/styles/Dashboard.module.css';
import sk from '@/styles/Skeleton.module.css';

/**
 * Initial load skeleton for the performance page (nav + header + chart region).
 */
export default function PerformancePageSkeleton() {
  return (
    <div
      className={styles.container}
      role="status"
      aria-busy="true"
      aria-label="Loading performance data"
    >
      <span className={sk.visuallyHidden}>Loading performance data</span>
      <nav className={styles.navSidebar}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={styles.navItem}
            style={{
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className={`${sk.bone} ${sk.boneNavItem}`} />
          </div>
        ))}
        <div className={styles.navDivider} />
        {[1, 2].map((i) => (
          <div
            key={`p-${i}`}
            className={styles.navProjectItem}
            style={{
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className={`${sk.bone} ${sk.boneNavItem}`} />
          </div>
        ))}
      </nav>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <span className={`${sk.bone} ${sk.boneLineLg}`} style={{ width: 260, height: 22, borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <span className={`${sk.bone}`} style={{ width: 88, height: 32, borderRadius: 8 }} />
              <span className={`${sk.bone}`} style={{ width: 96, height: 32, borderRadius: 8 }} />
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <aside className={styles.sidebar} style={{ minWidth: 200 }}>
            <div className={styles.sidebarSection} style={{ padding: 'var(--space-3)' }}>
              <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '80%', marginBottom: 16 }} />
              <span className={`${sk.bone}`} style={{ width: '100%', height: 40, borderRadius: 8, marginBottom: 12 }} />
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`${sk.bone}`}
                  style={{ width: '100%', height: 32, borderRadius: 6, marginBottom: 8 }}
                />
              ))}
            </div>
          </aside>
          <div className={sk.performanceChartSkeleton}>
            <div className={sk.performanceSkeletonToolbar}>
              <span className={`${sk.bone} ${sk.bonePill}`} style={{ width: 72 }} />
              <span className={`${sk.bone} ${sk.bonePill}`} style={{ width: 88 }} />
              <span className={`${sk.bone} ${sk.bonePill}`} style={{ width: 96 }} />
            </div>
            <span className={`${sk.bone} ${sk.boneBlock}`} style={{ flex: 1, minHeight: 200, width: '100%' }} />
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '24%' }} />
              <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '24%' }} />
              <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '24%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
