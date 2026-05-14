import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/Dashboard.module.css';
import monitorStyles from '@/styles/Monitors.module.css';

export default function MonitorsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [environment, setEnvironment] = useState('');
  const [pingUrls, setPingUrls] = useState('');
  const [creating, setCreating] = useState(false);
  const [runningPings, setRunningPings] = useState(false);
  const [error, setError] = useState('');

  const loadMonitors = useCallback(async (projectId) => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/monitors`);
    const j = await res.json();
    if (!res.ok) {
      setMonitors([]);
      return;
    }
    setMonitors(j.monitors || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch('/api/auth/me').then((r) => r.json());
        if (!me?.user) {
          router.push('/login');
          return;
        }
        setUser(me.user);
        const pr = await fetch('/api/projects').then((r) => r.json());
        const list = pr.projects || [];
        setProjects(list);
        if (list.length && !pid) setPid(list[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!pid) return;
    setError('');
    loadMonitors(pid);
  }, [pid, loadMonitors]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!pid) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${pid}/monitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim() || undefined,
          schedule: schedule.trim() || undefined,
          environment: environment.trim() || undefined,
          urls: pingUrls.trim()
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || 'Could not create monitor');
        return;
      }
      setSlug('');
      setName('');
      setSchedule('');
      setEnvironment('');
      setPingUrls('');
      await loadMonitors(pid);
    } finally {
      setCreating(false);
    }
  };

  const runPingsForProject = async () => {
    if (!pid) return;
    setRunningPings(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${pid}/monitors/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'Ping run failed');
      await loadMonitors(pid);
    } finally {
      setRunningPings(false);
    }
  };

  const runPingForMonitor = async (monitorId) => {
    if (!pid) return;
    setRunningPings(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${pid}/monitors/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitorId })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'Ping failed');
      await loadMonitors(pid);
    } finally {
      setRunningPings(false);
    }
  };

  const deleteMonitor = async (id, monSlug) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete monitor "${monSlug}"? SDK check-ins for this slug will be ignored until you create it again.`)
    )
      return;
    const res = await fetch(`/api/projects/${pid}/monitors?monitorId=${id}`, {
      method: 'DELETE'
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error || 'Delete failed');
      return;
    }
    await loadMonitors(pid);
  };

  if (loading) return <div className={styles.container}>Loading…</div>;
  if (!user) return null;

  const selectedProject = projects.find((project) => project.id === pid);

  return (
    <>
      <Head>
        <title>Monitors - Sentry Monitor</title>
      </Head>
      <div className={styles.container}>
        <nav className={styles.navSidebar}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <div className={styles.navItem} title="Global Dashboard">
              📊
              <div className={styles.navItemTooltip}>Global Dashboard</div>
            </div>
          </Link>
          <Link href="/performance" style={{ textDecoration: 'none' }}>
            <div className={styles.navItem} title="Performance">
              ⚡
              <div className={styles.navItemTooltip}>Performance</div>
            </div>
          </Link>
          <Link href="/monitors" style={{ textDecoration: 'none' }}>
            <div className={`${styles.navItem} ${styles.navItemActive}`} title="Cron monitors">
              🕒
              <div className={styles.navItemTooltip}>Monitors</div>
            </div>
          </Link>

          <div className={styles.navDivider}></div>

          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`${styles.navProjectItem} ${pid === project.id ? styles.navProjectItemActive : ''}`}
              onClick={() => setPid(project.id)}
              title={project.name}
            >
              {project.name.substring(0, 2).toUpperCase()}
              <div className={styles.navItemTooltip}>{project.name}</div>
            </button>
          ))}

          <div className={styles.navDivider}></div>

          {user.isAdmin && (
            <Link href="/admin" style={{ textDecoration: 'none' }}>
              <div className={styles.navItem} title="Admin">
                ⚙️
                <div className={styles.navItemTooltip}>Admin Settings</div>
              </div>
            </Link>
          )}

          <Link href="/profile" style={{ textDecoration: 'none' }}>
            <div className={styles.navItem} title="Profile">
              👤
              <div className={styles.navItemTooltip}>Your Profile</div>
            </div>
          </Link>
        </nav>

        <div className={styles.main}>
          <header className={styles.header}>
            <div className={styles.headerContent}>
              <h1 className={styles.logo}>
                <span className={styles.logoIcon}>🕒</span>
                Cron monitors
              </h1>
              <div className={styles.headerActions}>
                <select
                  className={styles.filterSelect}
                  value={pid || ''}
                  onChange={(e) => setPid(parseInt(e.target.value, 10))}
                  disabled={!projects.length}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => runPingsForProject()}
                  disabled={!pid || runningPings}
                  className={styles.headerButton}
                >
                  {runningPings ? 'Running…' : 'HTTP ping all'}
                </button>
              </div>
            </div>
          </header>

          <main className={monitorStyles.page}>
            <section className={monitorStyles.hero}>
              <div>
                <p className={monitorStyles.eyebrow}>
                  {selectedProject ? selectedProject.name : 'No project selected'}
                </p>
                <h2 className={monitorStyles.heroTitle}>Server-defined cron monitors</h2>
                <p className={monitorStyles.heroText}>
                  Configure your Sentry SDK with the same{' '}
                  <code className={monitorStyles.code}>monitor_slug</code>. Unknown slugs are ignored from
                  ingestion. Add ping URLs when you want the server to GET health endpoints on demand or from
                  <code className={monitorStyles.code}> /api/cron/monitors-ping</code>.
                </p>
              </div>
            </section>

            {error ? <div className={monitorStyles.error}>{error}</div> : null}

            <div className={monitorStyles.contentGrid}>
              <section className={monitorStyles.card}>
                <div className={monitorStyles.cardHeader}>
                  <h2 className={monitorStyles.cardTitle}>Create monitor</h2>
                  <p className={monitorStyles.cardDescription}>
                    Create the slug first, then send SDK check-ins or add health-check URLs.
                  </p>
                </div>

                <form onSubmit={handleCreate} className={monitorStyles.form}>
                  <div className={monitorStyles.field}>
                    <label className={monitorStyles.label}>Slug</label>
                    <input
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="e.g. nightly-backup"
                      pattern="^[a-zA-Z0-9_-]+$"
                      className={monitorStyles.input}
                    />
                  </div>

                  <div className={monitorStyles.field}>
                    <label className={monitorStyles.label}>Display name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Optional"
                      className={monitorStyles.input}
                    />
                  </div>

                  <div className={monitorStyles.field}>
                    <label className={monitorStyles.label}>Schedule hint</label>
                    <input
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                      placeholder="0 2 * * *"
                      className={monitorStyles.input}
                    />
                  </div>

                  <div className={monitorStyles.field}>
                    <label className={monitorStyles.label}>Environment</label>
                    <input
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      placeholder="production"
                      className={monitorStyles.input}
                    />
                  </div>

                  <div className={monitorStyles.field}>
                    <label className={monitorStyles.label}>URLs to ping</label>
                    <textarea
                      value={pingUrls}
                      onChange={(e) => setPingUrls(e.target.value)}
                      placeholder="https://example.com/health"
                      rows={5}
                      className={monitorStyles.textarea}
                    />
                    <p className={monitorStyles.helpText}>Optional, one http/https URL per line or comma-separated.</p>
                  </div>

                  <button type="submit" disabled={creating || !pid} className={monitorStyles.primaryButton}>
                    {creating ? 'Saving…' : 'Create monitor'}
                  </button>
                </form>
              </section>

              <section className={`${monitorStyles.card} ${monitorStyles.tableCard}`}>
                <div className={monitorStyles.cardHeader}>
                  <h2 className={monitorStyles.cardTitle}>Monitors</h2>
                  <p className={monitorStyles.cardDescription}>
                    {monitors.length
                      ? `${monitors.length} monitor${monitors.length === 1 ? '' : 's'} for this project`
                      : 'No monitors for this project yet'}
                  </p>
                </div>

                {!monitors.length ? (
                  <div className={monitorStyles.empty}>
                    Create a monitor on the left, then point the Sentry cron integration at that slug.
                  </div>
                ) : (
                  <div className={monitorStyles.tableWrapper}>
                    <table className={monitorStyles.table}>
                      <thead>
                        <tr>
                          <th>Slug</th>
                          <th>Name</th>
                          <th>Schedule</th>
                          <th>Env</th>
                          <th>Ping URLs</th>
                          <th>Status</th>
                          <th>Last check-in</th>
                          <th>Recent</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitors.map((m) => (
                          <tr key={m.id}>
                            <td className={monitorStyles.slugCell}>{m.slug}</td>
                            <td>{m.name || '—'}</td>
                            <td className={monitorStyles.monoCell}>{m.schedule || '—'}</td>
                            <td>{m.environment || '—'}</td>
                            <td className={monitorStyles.urlCell} title={(m.pingUrls || []).join('\n')}>
                              {m.pingUrls && m.pingUrls.length ? (
                                <>
                                  {(m.pingUrls || []).slice(0, 2).join(' · ')}
                                  {(m.pingUrls || []).length > 2 ? ` (+${m.pingUrls.length - 2})` : ''}
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              <span className={monitorStyles.statusPill}>{m.status}</span>
                            </td>
                            <td>
                              {m.lastCheckInAt ? new Date(m.lastCheckInAt).toLocaleString() : '—'}
                            </td>
                            <td className={monitorStyles.recentCell}>
                              {(m.checkIns || [])
                                .map((c) => `${c.status} @ ${new Date(c.createdAt).toLocaleTimeString()}`)
                                .join(' · ') || '—'}
                            </td>
                            <td>
                              <div className={monitorStyles.actions}>
                                <button
                                  type="button"
                                  onClick={() => runPingForMonitor(m.id)}
                                  disabled={runningPings || !m.pingUrls || !m.pingUrls.length}
                                  className={monitorStyles.secondaryButton}
                                  title={
                                    !m.pingUrls || !m.pingUrls.length
                                      ? 'Add URLs to this monitor'
                                      : 'GET each URL once'
                                  }
                                >
                                  Ping
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteMonitor(m.id, m.slug)}
                                  className={monitorStyles.dangerButton}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
