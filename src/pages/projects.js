import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ThemeToggle from '@/components/ThemeToggle';
import Icon from '@/components/Icon';
import shell from '@/styles/AppShell.module.css';
import projStyles from '@/styles/Projects.module.css';

const STATUS_RANK = {
  critical: 0,
  warning: 1,
  healthy: 2
};

const STATUS_LABELS = {
  critical: 'Needs attention',
  warning: 'Watch',
  healthy: 'Healthy'
};

function formatMetric(value, formatter, empty = 'No data') {
  if (value === null || value === undefined || Number.isNaN(value)) return empty;
  return formatter(value);
}

function formatDuration(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function formatPercent(value) {
  return `${value.toFixed(value === 100 ? 0 : 1)}%`;
}

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);

  const fetchSummaries = useCallback(async ({ background = false } = {}) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [projectsRes, summaryRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/analytics/projects-summary?window=24h')
      ]);

      const projectsData = await projectsRes.json().catch(() => ({}));
      const summaryData = await summaryRes.json().catch(() => ({}));

      if (!projectsRes.ok || !projectsData.success) {
        throw new Error(projectsData.error || 'Failed to load projects');
      }
      if (!summaryRes.ok || !summaryData.success) {
        throw new Error(summaryData.error || 'Failed to load project analytics');
      }

      setProjects(projectsData.projects || []);
      setSummaries(summaryData.projects || []);
      setGeneratedAt(summaryData.generatedAt || null);
    } catch (err) {
      setError(err.message || 'Could not load project analytics');
      setProjects([]);
      setSummaries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me').then((res) => res.json()).catch(() => ({}));
      if (!me?.user) {
        router.push('/login');
        return;
      }

      setUser(me.user);
      fetchSummaries();
    })();
  }, [fetchSummaries, router]);

  useEffect(() => {
    if (!autoRefresh || !user) return;

    const id = setInterval(() => {
      fetchSummaries({ background: true });
    }, 5000);

    return () => clearInterval(id);
  }, [autoRefresh, fetchSummaries, user]);

  const sortedSummaries = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const statusDiff = (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3);
      if (statusDiff !== 0) return statusDiff;

      const errorDiff = b.errors.recentErrorEvents - a.errors.recentErrorEvents;
      if (errorDiff !== 0) return errorDiff;

      return a.name.localeCompare(b.name);
    });
  }, [summaries]);

  if (loading && !user) {
    return <div className={shell.container}>Loading...</div>;
  }

  if (!user) return null;

  return (
    <>
      <Head>
        <title>Projects - Sentry Monitor</title>
      </Head>

      <div className={shell.container}>
        <nav className={shell.navSidebar}>
          <Link href="/projects" style={{ textDecoration: 'none' }}>
            <div className={`${shell.navItem} ${shell.navItemActive}`} title="Projects">
              <Icon name="folder" size={18} />
              <div className={shell.navItemTooltip}>Projects</div>
            </div>
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <div className={shell.navItem} title="Global Dashboard">
              <Icon name="dashboard" size={18} />
              <div className={shell.navItemTooltip}>Global Dashboard</div>
            </div>
          </Link>
          <Link href="/performance" style={{ textDecoration: 'none' }}>
            <div className={shell.navItem} title="Performance">
              <Icon name="activity" size={18} />
              <div className={shell.navItemTooltip}>Performance</div>
            </div>
          </Link>
          <Link href="/monitors" style={{ textDecoration: 'none' }}>
            <div className={shell.navItem} title="Cron monitors">
              <Icon name="clock" size={18} />
              <div className={shell.navItemTooltip}>Monitors</div>
            </div>
          </Link>

          <div className={shell.navDivider}></div>

          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className={shell.navProjectItem} title={project.name}>
                {project.name.substring(0, 2).toUpperCase()}
                {project._count?.issues > 0 && (
                  <span className={shell.projectBadge}>{project._count.issues}</span>
                )}
                <div className={shell.navItemTooltip}>{project.name}</div>
              </div>
            </Link>
          ))}

          <div className={shell.navDivider}></div>

          {user.isAdmin && (
            <Link href="/admin" style={{ textDecoration: 'none' }}>
              <div className={shell.navItem} title="Admin">
                <Icon name="settings" size={18} />
                <div className={shell.navItemTooltip}>Admin Settings</div>
              </div>
            </Link>
          )}

          <Link href="/profile" style={{ textDecoration: 'none' }}>
            <div className={shell.navItem} title="Profile">
              <Icon name="user" size={18} />
              <div className={shell.navItemTooltip}>Your Profile</div>
            </div>
          </Link>
        </nav>

        <div className={shell.main}>
          <header className={shell.header}>
            <div className={shell.headerContent}>
              <h1 className={shell.logo}>
                <span className={shell.logoIcon}><Icon name="folder" size={16} strokeWidth={2} /></span>
                Projects
              </h1>
              <div className={shell.headerActions}>
                <span className={projStyles.projectsTimestamp}>
                  24h health{generatedAt ? `, updated ${formatDate(generatedAt)}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setAutoRefresh((value) => !value)}
                  className={shell.headerButton}
                  title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                >
                  {autoRefresh ? 'Live' : 'Paused'}
                </button>
                <button
                  type="button"
                  onClick={() => fetchSummaries({ background: true })}
                  className={shell.headerButton}
                  disabled={refreshing}
                  title="Refresh project analytics"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <ThemeToggle />
                <span className={shell.userEmail}>{user.email}</span>
              </div>
            </div>
          </header>

          <main className={projStyles.projectsAnalyticsPage}>
            <section className={projStyles.projectsAnalyticsHero}>
              <div>
                <p className={projStyles.projectsEyebrow}>Last 24 hours</p>
                <h2 className={projStyles.projectsHeroTitle}>Projects analytics</h2>
                <p className={projStyles.projectsHeroText}>
                  Track response performance, ping health, and errors for every project in one place.
                </p>
              </div>
              <div className={projStyles.projectsHeroSummary}>
                <div>
                  <span className={projStyles.projectsHeroNumber}>{sortedSummaries.length}</span>
                  <span className={projStyles.projectsHeroLabel}>Projects</span>
                </div>
                <div>
                  <span className={projStyles.projectsHeroNumber}>
                    {sortedSummaries.filter((project) => project.status === 'critical').length}
                  </span>
                  <span className={projStyles.projectsHeroLabel}>Need attention</span>
                </div>
              </div>
            </section>

            {error ? (
              <div className={projStyles.projectsError}>{error}</div>
            ) : null}

            {loading ? (
              <div className={projStyles.projectsGrid}>
                {[0, 1, 2].map((item) => (
                  <div key={item} className={projStyles.projectAnalyticsCard}>
                    <div className={projStyles.projectsSkeletonLine}></div>
                    <div className={projStyles.projectsSkeletonGrid}>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedSummaries.length === 0 ? (
              <div className={shell.empty}>
                <div className={shell.emptyIcon}><Icon name="folder" size={36} strokeWidth={1.25} /></div>
                <h3 className={shell.emptyTitle}>No projects yet</h3>
                <p className={shell.emptyText}>Create a project to start collecting analytics.</p>
              </div>
            ) : (
              <div className={projStyles.projectsGrid}>
                {sortedSummaries.map((project) => (
                  <article
                    key={project.id}
                    className={`${projStyles.projectAnalyticsCard} ${projStyles[`projectStatus${project.status}`]}`}
                  >
                    <div className={projStyles.projectAnalyticsHeader}>
                      <div>
                        <h3 className={projStyles.projectAnalyticsTitle}>{project.name}</h3>
                        <p className={projStyles.projectAnalyticsKey}>{project.key}</p>
                      </div>
                      <span className={`${projStyles.projectStatusPill} ${projStyles[`projectStatusPill${project.status}`]}`}>
                        {STATUS_LABELS[project.status] || project.status}
                      </span>
                    </div>

                    <div className={projStyles.projectMetricsGrid}>
                      <div className={projStyles.projectMetric}>
                        <span className={projStyles.projectMetricLabel}>Response avg</span>
                        <strong className={projStyles.projectMetricValue}>
                          {formatMetric(project.response.avgMs, formatDuration)}
                        </strong>
                        <span className={projStyles.projectMetricMeta}>
                          p95 {formatMetric(project.response.p95Ms, formatDuration)} | {project.response.transactionCount} tx
                        </span>
                      </div>

                      <div className={projStyles.projectMetric}>
                        <span className={projStyles.projectMetricLabel}>Ping uptime</span>
                        <strong className={projStyles.projectMetricValue}>
                          {formatMetric(project.ping.uptimePercent, formatPercent)}
                        </strong>
                        <span className={projStyles.projectMetricMeta}>
                          {project.ping.failedCheckIns} failed | {project.ping.checkInCount} checks
                        </span>
                      </div>

                      <div className={projStyles.projectMetric}>
                        <span className={projStyles.projectMetricLabel}>Errors</span>
                        <strong className={projStyles.projectMetricValue}>
                          {project.errors.activeIssues}
                        </strong>
                        <span className={projStyles.projectMetricMeta}>
                          {project.errors.recentErrorEvents} events | {project.errors.recentIssues} new issues
                        </span>
                      </div>
                    </div>

                    <div className={projStyles.projectAnalyticsDetails}>
                      <span>
                        Latest ping: {project.ping.latestStatus || 'No ping data'} at {formatDate(project.ping.latestAt)}
                      </span>
                      <span>
                        Active monitors: {project.ping.activeMonitorCount}
                      </span>
                    </div>

                    <div className={projStyles.projectAnalyticsLinks}>
                      <Link href={`/dashboard?projectId=${project.id}`}>Issues</Link>
                      <Link href={`/performance?projectId=${project.id}`}>Performance</Link>
                      <Link href={`/monitors?projectId=${project.id}`}>Monitors</Link>
                      <Link href={`/project/${project.id}`}>Settings</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
