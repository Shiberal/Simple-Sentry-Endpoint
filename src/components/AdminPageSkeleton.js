import adminStyles from '@/styles/Admin.module.css';
import sk from '@/styles/Skeleton.module.css';

/**
 * Full-page skeleton for the admin panel (header, sidebar, stat grid).
 */
export default function AdminPageSkeleton() {
  return (
    <div
      className={adminStyles.container}
      role="status"
      aria-busy="true"
      aria-label="Loading admin"
    >
      <span className={sk.visuallyHidden}>Loading admin</span>
      <header className={adminStyles.header}>
        <div className={adminStyles.headerContent}>
          <span className={`${sk.bone} ${sk.boneLineLg}`} style={{ width: 200, height: 26, borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: 160, height: 14 }} />
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`${sk.bone}`}
                style={{ width: 76, height: 36, borderRadius: 8 }}
              />
            ))}
          </div>
        </div>
      </header>

      <aside className={adminStyles.sidebar}>
        <nav className={adminStyles.sidebarNav}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`${sk.bone}`}
              style={{ height: 44, width: '100%', borderRadius: 8 }}
            />
          ))}
        </nav>
      </aside>

      <main className={adminStyles.main}>
        <div className={adminStyles.content}>
          <span className={`${sk.bone} ${sk.boneLineMd}`} style={{ width: 240, marginBottom: 24 }} />
          <div className={adminStyles.statsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={adminStyles.statCard} style={{ pointerEvents: 'none' }}>
                <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '55%', marginBottom: 14 }} />
                <span className={`${sk.bone}`} style={{ width: '42%', height: 36, borderRadius: 8 }} />
                <span
                  className={`${sk.bone} ${sk.boneLine}`}
                  style={{ width: '70%', marginTop: 12 }}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
