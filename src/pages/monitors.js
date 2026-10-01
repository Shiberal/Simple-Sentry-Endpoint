import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import { describeSchedule } from '@/lib/monitor-health';
import { parseCronSchedule } from '@/lib/monitor-schedule';
import styles from '@/styles/Dashboard.module.css';
import m from '@/styles/Monitors.module.css';

const HEALTH = {
  ok: { label: 'Healthy', tone: 'ok' },
  failing: { label: 'Failing', tone: 'bad' },
  missed: { label: 'Missed', tone: 'warn' },
  running: { label: 'Running', tone: 'info' },
  paused: { label: 'Paused', tone: 'muted' },
  pending: { label: 'Waiting', tone: 'muted' },
  unknown: { label: 'No schedule', tone: 'muted' }
};

const PRESETS = [
  ['*/5 * * * *', 'Every 5 minutes'],
  ['*/15 * * * *', 'Every 15 minutes'],
  ['0 * * * *', 'Every hour'],
  ['0 2 * * *', 'Daily at 02:00'],
  ['0 9 * * 1-5', 'Weekdays at 09:00']
];

const REFRESH_MS = 15000;

function fmtDuration(ms) {
  if (ms == null) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${String(sec).padStart(2, '0')}s`;
}

function span(ms) {
  const abs = Math.abs(ms);
  if (abs < 60000) return 'under a minute';
  const min = Math.round(abs / 60000);
  if (min < 60) return `${min}m`;
  const hours = Math.round(abs / 3600000);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(abs / 86400000)}d`;
}

function ago(date, now) {
  if (!date) return 'never';
  const ms = now - new Date(date).getTime();
  return ms < 60000 ? 'just now' : `${span(ms)} ago`;
}

function until(date, now) {
  if (!date) return '-';
  const ms = new Date(date).getTime() - now;
  return ms <= 0 ? 'due now' : ms < 60000 ? 'in under a minute' : `in ${span(ms)}`;
}

/** Last 30 runs as a strip of bars: colour = outcome, height = duration relative to the slowest. */
function History({ history }) {
  const SLOTS = 30;
  const slowest = Math.max(1, ...history.map((h) => h.durationMs || 0));
  const empty = Math.max(0, SLOTS - history.length);
  return (
    <div className={m.history} role="img" aria-label={`Last ${history.length} runs`}>
      {Array.from({ length: empty }, (_, i) => <span key={`e${i}`} className={m.barEmpty} />)}
      {history.map((h, i) => {
        const tone = h.status === 'ok' ? m.barOk : h.status === 'error' ? m.barBad : m.barRun;
        const height = h.durationMs ? 30 + Math.round((h.durationMs / slowest) * 70) : 45;
        return (
          <span
            key={i}
            className={`${m.bar} ${tone}`}
            style={{ height: `${height}%` }}
            title={`${new Date(h.at).toLocaleString()} · ${h.status === 'in_progress' ? 'started' : h.status} · ${fmtDuration(h.durationMs)}`}
          />
        );
      })}
    </div>
  );
}

export default function MonitorsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [data, setData] = useState({ monitors: [], summary: null, scheduler: null });
  const [loading, setLoading] = useState(true);
  const [loadingMonitors, setLoadingMonitors] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null); // monitor id, or 'all'
  const [error, setError] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null); // monitor being edited, or null when creating
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: '', name: '', schedule: '', environment: '', urls: '' });

  const loadMonitors = useCallback(async (projectId, { quiet = false } = {}) => {
    if (!projectId) return;
    if (!quiet) setLoadingMonitors(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/monitors`);
      const j = await res.json();
      if (!res.ok) {
        if (!quiet) setError(j.error || 'Could not load monitors');
        return;
      }
      setData({ monitors: j.monitors || [], summary: j.summary, scheduler: j.scheduler });
      setNow(Date.now());
    } finally {
      setLoadingMonitors(false);
    }
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
    if (!router.isReady || !projects.length || !router.query.projectId) return;
    const projectId = parseInt(router.query.projectId, 10);
    if (!isNaN(projectId) && projects.some((project) => project.id === projectId)) setPid(projectId);
  }, [projects, router.isReady, router.query.projectId]);

  useEffect(() => {
    if (!pid) return;
    setError('');
    setFilter('all');
    setExpanded(null);
    loadMonitors(pid);
  }, [pid, loadMonitors]);

  // Keep the board live: refresh while the tab is visible, and catch up when it returns
  useEffect(() => {
    if (!pid) return undefined;
    const tick = () => {
      if (!document.hidden) loadMonitors(pid, { quiet: true });
    };
    const id = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [pid, loadMonitors]);

  // Relative times ("3m ago") advance between refreshes
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const api = async (path, options) => {
    const res = await fetch(`/api/projects/${pid}/monitors${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Request failed');
    return j;
  };

  const closeDialog = () => {
    setShowNew(false);
    setEditing(null);
    setForm({ slug: '', name: '', schedule: '', environment: '', urls: '' });
  };

  const openNew = () => {
    setEditing(null);
    setForm({ slug: '', name: '', schedule: '', environment: '', urls: '' });
    setShowNew(true);
  };

  const openEdit = (mon) => {
    setEditing(mon);
    setForm({
      slug: mon.slug,
      name: mon.name || '',
      schedule: mon.schedule || '',
      environment: mon.environment || '',
      urls: (mon.pingUrls || []).join('\n')
    });
    setShowNew(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      if (editing) {
        // Empty strings clear a field; the slug is fixed because SDK check-ins are matched by it
        await api('', {
          method: 'PATCH',
          body: JSON.stringify({
            monitorId: editing.id,
            name: form.name.trim(),
            schedule: form.schedule.trim(),
            environment: form.environment.trim(),
            urls: form.urls.trim()
          })
        });
      } else {
        await api('', {
          method: 'POST',
          body: JSON.stringify({
            slug: form.slug.trim(),
            name: form.name.trim() || undefined,
            schedule: form.schedule.trim() || undefined,
            environment: form.environment.trim() || undefined,
            urls: form.urls.trim()
          })
        });
      }
      closeDialog();
      setFilter('all'); // make sure the new monitor is visible
      await loadMonitors(pid, { quiet: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const runNow = async (monitorId) => {
    setBusy(monitorId ?? 'all');
    setError('');
    try {
      await fetch(`/api/projects/${pid}/monitors/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(monitorId ? { monitorId } : {})
      }).then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ping failed');
      });
      await loadMonitors(pid, { quiet: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const togglePause = async (monitor) => {
    setBusy(monitor.id);
    setError('');
    try {
      await api('', { method: 'PATCH', body: JSON.stringify({ monitorId: monitor.id, status: monitor.status === 'paused' ? 'active' : 'paused' }) });
      await loadMonitors(pid, { quiet: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const deleteMonitor = async (monitor) => {
    if (!window.confirm(`Delete monitor "${monitor.slug}"? SDK check-ins for this slug will be ignored until you create it again.`)) return;
    try {
      await api(`?monitorId=${monitor.id}`, { method: 'DELETE' });
      await loadMonitors(pid, { quiet: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const { monitors, summary, scheduler } = data;
  const visible = useMemo(
    () => (filter === 'all' ? monitors : monitors.filter((mon) => mon.health === filter)),
    [monitors, filter]
  );
  const hasPingMonitors = monitors.some((mon) => mon.pingUrls.length > 0);
  const scheduleOk = !form.schedule.trim() || !!parseCronSchedule(form.schedule.trim());

  if (loading) return <div className={styles.container}>Loading…</div>;
  if (!user) return null;

  const tiles = summary
    ? [
        { key: 'all', label: 'Monitors', value: summary.total, tone: 'plain' },
        { key: 'ok', label: 'Healthy', value: summary.ok, tone: 'ok' },
        { key: 'failing', label: 'Failing', value: summary.failing, tone: 'bad' },
        { key: 'missed', label: 'Missed', value: summary.missed, tone: 'warn' },
        { key: 'paused', label: 'Paused', value: summary.paused, tone: 'muted' }
      ]
    : [];

  return (
    <>
      <Head>
        <title>Monitors - Sentry Monitor</title>
      </Head>
      <div className={styles.container}>
        <nav className={styles.navSidebar} aria-label="Primary">
          <Link href="/projects" style={{ textDecoration: 'none' }}>
            <div className={styles.navItem} title="Projects">
              <Icon name="folder" size={18} />
              <div className={styles.navItemTooltip}>Projects</div>
            </div>
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <div className={styles.navItem} title="Global Dashboard">
              <Icon name="dashboard" size={18} />
              <div className={styles.navItemTooltip}>Global Dashboard</div>
            </div>
          </Link>
          <Link href="/performance" style={{ textDecoration: 'none' }}>
            <div className={styles.navItem} title="Performance">
              <Icon name="activity" size={18} />
              <div className={styles.navItemTooltip}>Performance</div>
            </div>
          </Link>
          <Link href="/monitors" style={{ textDecoration: 'none' }}>
            <div className={`${styles.navItem} ${styles.navItemActive}`} title="Cron monitors">
              <Icon name="clock" size={18} />
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
                <Icon name="settings" size={18} />
                <div className={styles.navItemTooltip}>Admin Settings</div>
              </div>
            </Link>
          )}

          <Link href="/profile" style={{ textDecoration: 'none' }}>
            <div className={styles.navItem} title="Profile">
              <Icon name="user" size={18} />
              <div className={styles.navItemTooltip}>Your Profile</div>
            </div>
          </Link>
        </nav>
        <div className={styles.main}>
          <header className={styles.header}>
            <div className={styles.headerContent}>
              <h1 className={styles.logo}>
                <span className={styles.logoIcon}><Icon name="clock" size={16} strokeWidth={2} /></span>
                Cron monitors
              </h1>
              <div className={styles.headerActions}>
                <select
                  className={styles.filterSelect}
                  value={pid || ''}
                  onChange={(e) => setPid(parseInt(e.target.value, 10))}
                  disabled={!projects.length}
                  aria-label="Project"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => loadMonitors(pid)} className={styles.headerButton} aria-label="Refresh" title="Refresh">
                  <span className={loadingMonitors ? styles.spinning : styles.iconWrap}><Icon name="refresh" size={16} /></span>
                </button>
                {hasPingMonitors && (
                  <button type="button" onClick={() => runNow(null)} disabled={busy === 'all'} className={styles.headerButton}>
                    <Icon name="play" size={14} /> <span className={m.headerLabel}>{busy === 'all' ? 'Running…' : 'Run all pings'}</span>
                  </button>
                )}
                <button type="button" onClick={openNew} className={m.newButton} aria-label="New monitor">
                  <Icon name="plus" size={14} strokeWidth={2.25} /> <span className={m.headerLabel}>New monitor</span>
                </button>
              </div>
            </div>
          </header>

          <main className={m.page}>
            {error ? <div className={m.error} role="alert">{error}</div> : null}

            {scheduler?.hasPingMonitors && scheduler.state !== 'running' && (
              <div className={m.banner} role="status">
                <Icon name="alert" size={18} />
                <div>
                  <strong>
                    {scheduler.state === 'stopped'
                      ? `The ping worker stopped reporting ${ago(scheduler.workers[0]?.lastTickAt, now)}.`
                      : 'No ping worker has reported in.'}
                  </strong>{' '}
                  Monitors with ping URLs only run while a scheduler is running
                  {scheduler.overduePingMonitors > 0 && `, and ${scheduler.overduePingMonitors} ${scheduler.overduePingMonitors === 1 ? 'is' : 'are'} overdue`}.
                  Start <code className={m.code}>npm run worker:ping</code>, use the Docker image (it starts the worker), set <code className={m.code}>ENABLE_MONITOR_HTTP_PINGER=true</code> (not effective in Docker),
                  or call <code className={m.code}>/api/cron/monitors-ping</code> from an external scheduler.
                  {scheduler.workers[0]?.lastError && <> Last error: <code className={m.code}>{scheduler.workers[0].lastError}</code></>}
                </div>
              </div>
            )}

            {scheduler?.hasPingMonitors && scheduler.state === 'running' && (
              <div className={m.workerLine} role="status">
                <span className={m.workerDot} />
                {(() => {
                  const w = scheduler.workers.find((x) => x.alive);
                  return (
                    <span>
                      Scheduler running ({w.kind === 'in-process' ? 'in the web server' : w.kind === 'cron' ? 'external cron' : 'ping worker'}) · last check {ago(w.lastTickAt, now)} · {w.ticks} check{w.ticks === 1 ? '' : 's'} since {new Date(w.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {w.lastError && <span className={m.textBad}> · last error: {w.lastError}</span>}
                      {scheduler.overduePingMonitors > 0 && <span className={m.textWarn}> · {scheduler.overduePingMonitors} monitor{scheduler.overduePingMonitors === 1 ? '' : 's'} overdue, check the worker logs</span>}
                    </span>
                  );
                })()}
              </div>
            )}

            {summary && (
              <section className={m.summary} aria-label="Summary">
                {tiles.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setFilter(filter === t.key ? 'all' : t.key)}
                    className={`${m.tile} ${m[`tone_${t.tone}`]} ${filter === t.key && t.key !== 'all' ? m.tileActive : ''}`}
                    aria-pressed={filter === t.key}
                  >
                    <span className={m.tileValue}>{t.value}</span>
                    <span className={m.tileLabel}>{t.label}</span>
                  </button>
                ))}
                <div className={`${m.tile} ${m.tileStatic}`}>
                  <span className={m.tileValue}>{summary.uptime24h == null ? '-' : `${summary.uptime24h}%`}</span>
                  <span className={m.tileLabel}>Success, 24h · {summary.runs24h} runs</span>
                </div>
              </section>
            )}

            {loadingMonitors && !monitors.length ? (
              <div className={m.skeletonList} aria-busy="true">{[0, 1, 2].map((n) => <div key={n} className={m.skeleton} />)}</div>
            ) : monitors.length === 0 ? (
              <div className={m.empty}>
                <Icon name="clock" size={36} strokeWidth={1.25} />
                <h2 className={m.emptyTitle}>No monitors yet</h2>
                <p className={m.emptyText}>
                  Create a monitor with the same slug your Sentry SDK uses in <code className={m.code}>monitor_slug</code>,
                  or add ping URLs to have the server check them on a schedule.
                </p>
                <button type="button" onClick={openNew} className={m.newButton}>
                  <Icon name="plus" size={14} strokeWidth={2.25} /> New monitor
                </button>
              </div>
            ) : (
              <ul className={m.list}>
                {visible.length === 0 && <li className={m.noMatch}>No monitors match this filter. <button className={m.linkButton} onClick={() => setFilter('all')}>Show all</button></li>}
                {visible.map((mon) => {
                  const h = HEALTH[mon.health] || HEALTH.unknown;
                  const open = expanded === mon.id;
                  const paused = mon.status === 'paused';
                  return (
                    <li key={mon.id} className={`${m.row} ${m[`row_${h.tone}`]}`}>
                      <div className={m.rowMain}>
                        <div className={m.identity}>
                          <span className={`${m.status} ${m[`tone_${h.tone}`]} ${mon.health === 'running' ? m.pulse : ''}`} title={mon.healthReason}>
                            <span className={m.statusDot} />{h.label}
                          </span>
                          <div className={m.names}>
                            <span className={m.name}>{mon.name || mon.slug}</span>
                            <span className={m.slug}>{mon.slug}{mon.environment ? ` · ${mon.environment}` : ''}</span>
                            {mon.health === 'failing' && <span className={m.reason} title={mon.healthReason}>{mon.healthReason.replace('Last run failed: ', '')}</span>}
                          </div>
                        </div>

                        <History history={mon.history} />

                        <dl className={m.facts}>
                          <div title={mon.lastRunAt ? new Date(mon.lastRunAt).toLocaleString() : ''}>
                            <dt>Last run</dt>
                            <dd>{ago(mon.lastRunAt, now)}{mon.lastDurationMs != null && <span className={m.faint}> · {fmtDuration(mon.lastDurationMs)}</span>}</dd>
                          </div>
                          <div title={mon.nextRunAt ? new Date(mon.nextRunAt).toLocaleString() : ''}>
                            <dt>Next</dt>
                            <dd>{paused ? 'paused' : until(mon.nextRunAt, now)}</dd>
                          </div>
                          <div>
                            <dt>Success 24h</dt>
                            <dd className={mon.stats.uptime24h != null && mon.stats.uptime24h < 100 ? m.textWarn : ''}>
                              {mon.stats.uptime24h == null ? '-' : `${mon.stats.uptime24h}%`}
                            </dd>
                          </div>
                        </dl>

                        <div className={m.rowActions}>
                          {mon.pingUrls.length > 0 && !paused && (
                            <button type="button" className={m.iconButton} onClick={() => runNow(mon.id)} disabled={busy === mon.id} aria-label={`Run ${mon.slug} now`} title="Run pings now">
                              <span className={busy === mon.id ? styles.spinning : styles.iconWrap}><Icon name="play" size={14} /></span>
                            </button>
                          )}
                          <button type="button" className={m.iconButton} onClick={() => togglePause(mon)} disabled={busy === mon.id} aria-label={paused ? `Resume ${mon.slug}` : `Pause ${mon.slug}`} title={paused ? 'Resume' : 'Pause'}>
                            <Icon name={paused ? 'play' : 'pause'} size={14} />
                          </button>
                          <button type="button" className={`${m.iconButton} ${open ? m.iconButtonOpen : ''}`} onClick={() => setExpanded(open ? null : mon.id)} aria-expanded={open} aria-label={`Details for ${mon.slug}`} title="Details">
                            <Icon name="chevronDown" size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                      {open && (
                        <div className={m.details}>
                          <div className={m.detailGrid}>
                            <div>
                              <h3 className={m.detailTitle}>Configuration</h3>
                              <p className={m.detailLine}><span>Schedule</span> {mon.scheduleText ? <>{mon.scheduleText}{mon.schedule && mon.scheduleText !== mon.schedule && <code className={m.code}>{mon.schedule}</code>}</> : 'None (SDK check-ins only)'}</p>
                              <p className={m.detailLine}><span>Status</span> {mon.healthReason}</p>
                              <p className={m.detailLine}><span>Average run</span> {fmtDuration(mon.stats.avgDurationMs)}</p>
                              <p className={m.detailLine}><span>Last 24h</span> {mon.stats.ok24h} ok · {mon.stats.error24h} failed</p>
                              {mon.pingUrls.length > 0 && (
                                <div className={m.detailLine}><span>Ping URLs</span>
                                  <ul className={m.urlList}>{mon.pingUrls.map((u) => <li key={u} className={m.mono}>{u}</li>)}</ul>
                                </div>
                              )}
                              <div className={m.detailActions}>
                                <button type="button" className={m.editButton} onClick={() => openEdit(mon)}>Edit monitor</button>
                                <button type="button" className={m.dangerLink} onClick={() => deleteMonitor(mon)}>
                                  <Icon name="trash" size={13} /> Delete
                                </button>
                              </div>
                            </div>
                            <div>
                              <h3 className={m.detailTitle}>Recent runs</h3>
                              {mon.checkIns.length === 0 ? (
                                <p className={m.faint}>No runs recorded yet.</p>
                              ) : (
                                <table className={m.runs}>
                                  <thead><tr><th>When</th><th>Result</th><th>Took</th><th>Source</th></tr></thead>
                                  <tbody>
                                    {mon.checkIns.map((c) => (
                                      <tr key={c.id}>
                                        <td title={new Date(c.createdAt).toLocaleString()}>{ago(c.createdAt, now)}</td>
                                        <td><span className={`${m.runResult} ${c.status === 'ok' ? m.textOk : c.status === 'error' ? m.textBad : m.textInfo}`}>{c.status === 'in_progress' ? 'started' : c.status}</span>
                                          {c.results && c.status === 'error' && (
                                            <span className={m.faint}> {c.results.filter((r) => !r.ok).map((r) => r.status || r.error).join(', ')}</span>
                                          )}
                                        </td>
                                        <td className={m.mono}>{fmtDuration(c.durationMs)}</td>
                                        <td>{c.source === 'server_http' ? 'Server ping' : 'SDK'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </main>
        </div>
      </div>

      {showNew && (
        <div className={m.overlay} onClick={closeDialog}>
          <form className={m.dialog} role="dialog" aria-modal="true" aria-label={editing ? 'Edit monitor' : 'New monitor'} onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <h2 className={m.dialogTitle}>{editing ? `Edit ${editing.slug}` : 'New monitor'}</h2>
            <p className={m.dialogText}>Use the same slug in your SDK&apos;s <code className={m.code}>monitor_slug</code>. Add ping URLs if the server should check them for you.</p>

            <label className={m.field}>
              <span className={m.label}>Slug</span>
              <input required autoFocus={!editing} disabled={!!editing} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="nightly-backup" pattern="^[a-zA-Z0-9_\-]{1,128}$" className={m.input} />
            </label>
            <label className={m.field}>
              <span className={m.label}>Display name <em>(optional)</em></span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nightly backup" className={m.input} />
            </label>
            <label className={m.field}>
              <span className={m.label}>Schedule <em>(cron, server time)</em></span>
              <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="*/5 * * * *" list="cron-presets" className={`${m.input} ${m.mono}`} aria-invalid={!scheduleOk} />
              <datalist id="cron-presets">{PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>
              <span className={`${m.hint} ${scheduleOk ? '' : m.textBad}`}>
                {!form.schedule.trim() ? 'Without a schedule, missed runs cannot be detected.' : scheduleOk ? describeSchedule(form.schedule) : 'Not a valid 5-field cron expression.'}
              </span>
            </label>
            <label className={m.field}>
              <span className={m.label}>Environment <em>(optional)</em></span>
              <input value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} placeholder="production" className={m.input} />
            </label>
            <label className={m.field}>
              <span className={m.label}>URLs to ping <em>(optional)</em></span>
              <textarea value={form.urls} onChange={(e) => setForm({ ...form, urls: e.target.value })} placeholder="https://example.com/health" rows={3} className={`${m.input} ${m.mono}`} />
              <span className={m.hint}>One per line. The server GETs them on schedule.</span>
            </label>

            <div className={m.dialogActions}>
              <button type="button" className={m.cancelButton} onClick={closeDialog}>Cancel</button>
              <button type="submit" className={m.newButton} disabled={creating || !scheduleOk}>{creating ? 'Saving…' : editing ? 'Save changes' : 'Create monitor'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
