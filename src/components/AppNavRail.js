import Link from 'next/link';
import styles from '@/styles/Dashboard.module.css';

/**
 * Shared Discord-style icon rail for dashboard and performance.
 */
export default function AppNavRail({
  mode,
  router,
  user,
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  onLogout,
}) {
  const dashboardIconActive =
    router.pathname === '/dashboard' &&
    (mode === 'dashboard' ? selectedProject == null : false);

  return (
    <nav className={styles.navSidebar} aria-label="Main navigation">
      <Link href="/dashboard" style={{ textDecoration: 'none' }}>
        <div
          className={`${styles.navItem} ${dashboardIconActive ? styles.navItemActive : ''}`}
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

      <div className={styles.navDivider} />

      {mode === 'dashboard' && (
        <>
          <div
            role="button"
            tabIndex={0}
            className={`${styles.navProjectItem} ${selectedProject === null ? styles.navProjectItemActive : ''}`}
            onClick={() => onSelectProject(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectProject(null);
              }
            }}
            title="All Projects"
          >
            ALL
            <div className={styles.navItemTooltip}>All Projects</div>
          </div>

          {projects.map((project) => (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              className={`${styles.navProjectItem} ${selectedProject === project.id ? styles.navProjectItemActive : ''}`}
              onClick={() => onSelectProject(project.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectProject(project.id);
                }
              }}
              title={project.name}
            >
              {project.name.substring(0, 2).toUpperCase()}
              {project._count?.issues > 0 && (
                <span className={styles.projectBadge}>{project._count.issues}</span>
              )}
              <div className={styles.navItemTooltip}>{project.name}</div>
            </div>
          ))}

          <button
            type="button"
            className={styles.navProjectItem}
            onClick={onCreateProject}
            title="Create New Project"
            style={{ color: 'var(--success)', fontSize: '24px' }}
          >
            +
            <div className={styles.navItemTooltip}>Create New Project</div>
          </button>
        </>
      )}

      {mode === 'performance' &&
        projects.map((project) => (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            className={`${styles.navProjectItem} ${selectedProject === project.id ? styles.navProjectItemActive : ''}`}
            onClick={() => onSelectProject(project.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectProject(project.id);
              }
            }}
            title={project.name}
          >
            {project.name.substring(0, 2).toUpperCase()}
            <div className={styles.navItemTooltip}>{project.name}</div>
          </div>
        ))}

      <div className={styles.navDivider} />

      {user?.isAdmin && (
        <Link href="/admin" style={{ textDecoration: 'none' }}>
          <div
            className={`${styles.navItem} ${router.pathname === '/admin' ? styles.navItemActive : ''}`}
            title="Admin"
          >
            ⚙️
            <div className={styles.navItemTooltip}>Admin Settings</div>
          </div>
        </Link>
      )}

      <Link href="/profile" style={{ textDecoration: 'none' }}>
        <div
          className={`${styles.navItem} ${router.pathname === '/profile' ? styles.navItemActive : ''}`}
          title="Profile"
        >
          👤
          <div className={styles.navItemTooltip}>Your Profile</div>
        </div>
      </Link>

      {user && onLogout && (
        <button type="button" className={styles.navItem} onClick={onLogout} title="Logout">
          🚪
          <div className={styles.navItemTooltip}>Logout</div>
        </button>
      )}
    </nav>
  );
}
