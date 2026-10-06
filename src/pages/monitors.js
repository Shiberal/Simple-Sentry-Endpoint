import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import MonitorDialog from '@/components/monitors/MonitorDialog';
import styles from '@/styles/Dashboard.module.css';
import {
  ActivityOverview, CHART_MODES, ChartPanel, CheckInHistory, HEALTH, History, REFRESH_MS, RANGE_OPTIONS,
  StatsPanel, monitorApi, ago, fmtDuration, pct, rateTone, until, projectLabel, scopeOf, Sparkline } from '@/components/monitors/shared';

import m from '@/styles/Monitors.module.css';

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
  const [range, setRange] = useState('30d');
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [sort, setSort] = useState('status');
  const [busy, setBusy] = useState(null); // monitor id, or 'all'
  const [error, setError] = useState('');

  const summaryRef = useRef(null);
  const [compact, setCompact] = useState(false); // summary tiles scrolled out of view
  const hasSummary = !!data.summary;
  useEffect(() => {
    const el = summaryRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [hasSummary]);

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null); // monitor being edited, or null when creating

  const loadMonitors = useCallback(async (projectId, { quiet = false } = {}) => {
    if (!projectId) return;
    if (!quiet) setLoadingMonitors(true);
    try {
      const res = await fetch(projectId === 'all' ? `/api/monitors?range=${range}` : `/api/projects/${projectId}/monitors?range=${range}`);
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
  }, [range]);

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
        if (list.length && !pid) setPid('all');
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

  const closeDialog = () => {
    setShowNew(false);
    setEditing(null);
  };

  const openNew = () => {
    setEditing(null);
    setShowNew(true);
  };

  const openEdit = (mon) => {
    setEditing(mon);
    setShowNew(true);
  };

  const guarded = async (id, fn) => {
    setBusy(id);
    setError('');
    try {
      await fn();
      await loadMonitors(pid, { quiet: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (monitorId) => {
    if (monitorId) return guarded(monitorId, () => monitorApi.run(data.monitors.find((x) => x.id === monitorId)));
    // Run all (or all of the selected project): one request per project
    const ids = [...new Set(data.monitors.map((x) => x.projectId ?? 'standalone'))];
    return guarded('all', () => Promise.all(ids.map((projectId) => fetch(`/api/projects/${projectId}/monitors/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ping failed');
    }))));
  };

  const togglePause = (monitor) => guarded(monitor.id, () => monitorApi.setPaused(monitor, monitor.status !== 'paused'));

  const deleteMonitor = async (monitor) => {
    if (!window.confirm(`Delete monitor "${monitor.slug}"? SDK check-ins for this slug will be ignored until you create it again.`)) return;
    guarded(monitor.id, () => monitorApi.remove(monitor));
  };

  const { monitors, summary, scheduler } = data;
  const environments = useMemo(() => [...new Set(monitors.map((mon) => mon.environment).filter(Boolean))].sort(), [monitors]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = monitors.filter((mon) =>
      (filter === 'all' || mon.health === filter) &&
      (envFilter === 'all' || mon.environment === envFilter) &&
      (!q || `${mon.name || ''} ${mon.slug}`.toLowerCase().includes(q))
    );
    const rate = (mon) => mon.stats.windows[range === '24h' ? '24h' : range === '7d' ? '7d' : '30d'].uptime;
    const sorters = {
      status: null, // API order: worst health first
      name: (a, b) => (a.name || a.slug).localeCompare(b.name || b.slug),
      uptime: (a, b) => (rate(a) ?? 101) - (rate(b) ?? 101),
      slowest: (a, b) => (b.stats.windows['24h'].p95Ms ?? -1) - (a.stats.windows['24h'].p95Ms ?? -1),
      failures: (a, b) => b.stats.windows['30d'].error - a.stats.windows['30d'].error,
      recent: (a, b) => new Date(b.lastRunAt || 0) - new Date(a.lastRunAt || 0)
    };
    return sorters[sort] ? [...list].sort(sorters[sort]) : list;
  }, [monitors, filter, envFilter, search, sort, range]);
  const hasPingMonitors = monitors.some((mon) => mon.pingUrls.length > 0);

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

          <button
            type="button"
            className={`${styles.navProjectItem} ${pid === 'all' ? styles.navProjectItemActive : ''}`}
            onClick={() => setPid('all')}
            title="All projects"
          >
            ALL
            <div className={styles.navItemTooltip}>All projects</div>
          </button>
          <button
            type="button"
            className={`${styles.navProjectItem} ${pid === 'standalone' ? styles.navProjectItemActive : ''}`}
            onClick={() => setPid('standalone')}
            title="Standalone monitors (no project)"
          >
            --
            <div className={styles.navItemTooltip}>Standalone (no project)</div>
          </button>
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
                Monitors
              </h1>
              <div className={styles.headerActions}>
                <select
                  className={styles.filterSelect}
                  value={pid || ''}
                  onChange={(e) => setPid(e.target.value === 'all' || e.target.value === 'standalone' ? e.target.value : parseInt(e.target.value, 10))}
                  aria-label="Project"
                >
                  <option value="all">All projects</option>
                  <option value="standalone">Standalone (no project)</option>
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
            {summary && (
              <div className={m.stickyWrap}>
                <div className={`${m.stickyBar} ${compact ? m.stickyOn : ''}`} aria-hidden={!compact}>
                  {tiles.filter((t) => t.key !== 'paused').map((t) => (
                    <button key={t.key} type="button" tabIndex={compact ? 0 : -1} onClick={() => setFilter(filter === t.key ? 'all' : t.key)} className={`${m.pill} ${m[`tone_${t.tone}`]} ${filter === t.key && t.key !== 'all' ? m.pillActive : ''}`}>
                      <strong>{t.value}</strong> {t.label}
                    </button>
                  ))}
                  <span className={m.pill}><strong className={rateTone(summary.stats?.windows?.['24h']?.uptime)}>{pct(summary.stats?.windows?.['24h']?.uptime)}</strong> 24h</span>
                  <span className={m.pill}><strong>{fmtDuration(summary.stats?.windows?.['24h']?.avgMs)}</strong> avg</span>
                  {!!summary.stats?.incidentsOpen && <span className={`${m.pill} ${m.textBad}`}><strong>{summary.stats.incidentsOpen}</strong> open incidents</span>}
                  <Sparkline series={summary.stats?.daily} />
                </div>
              </div>
            )}
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
              <section className={m.summary} aria-label="Summary" ref={summaryRef}>
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
                {['24h', '7d', '30d'].map((k) => {
                  const w = summary.stats?.windows?.[k];
                  return (
                    <div key={k} className={`${m.tile} ${m.tileStatic}`}>
                      <span className={`${m.tileValue} ${rateTone(w?.uptime)}`}>{pct(w?.uptime)}</span>
                      <span className={m.tileLabel}>Success, {k} · {w?.runs ?? 0} runs</span>
                    </div>
                  );
                })}
                <div className={`${m.tile} ${m.tileStatic}`}>
                  <span className={m.tileValue}>{fmtDuration(summary.stats?.windows?.['24h']?.avgMs)}</span>
                  <span className={m.tileLabel}>Avg run, 24h · p95 {fmtDuration(summary.stats?.windows?.['24h']?.p95Ms)}</span>
                </div>
                <div className={`${m.tile} ${m.tileStatic}`}>
                  <span className={`${m.tileValue} ${summary.stats?.incidentsOpen ? m.textBad : ''}`}>{summary.stats?.incidentsOpen ?? 0}</span>
                  <span className={m.tileLabel}>Open incidents · {summary.stats?.incidents30d ?? 0} in 30d</span>
                </div>
              </section>
            )}

            {pid === 'all' && monitors.length > 0 && <ActivityOverview refreshKey={String(summary?.runs24h)} monitors={monitors} />}

            {monitors.length > 0 && summary?.stats && (
              <section className={m.overview} aria-label="Project overview">
                <div className={m.overviewHead}>
                  <h2 className={m.detailTitle}>All monitors</h2>
                  <div className={m.segmented} role="group" aria-label="Range">
                    {RANGE_OPTIONS.map((r) => (
                      <button key={r} type="button" aria-pressed={range === r} className={`${m.segment} ${range === r ? m.segmentOn : ''}`} onClick={() => setRange(r)}>{r}</button>
                    ))}
                  </div>
                </div>
                <ChartPanel series={summary.stats.daily} range={range} height={pid === 'all' ? 100 : 170} modes={[CHART_MODES[0], CHART_MODES[2]]} />
              </section>
            )}

            {monitors.length > 0 && (
              <div className={m.toolbar}>
                <input type="search" className={m.search} placeholder="Search monitors" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search monitors" />
                {environments.length > 0 && (
                  <select className={m.select} value={envFilter} onChange={(e) => setEnvFilter(e.target.value)} aria-label="Environment">
                    <option value="all">All environments</option>
                    {environments.map((env) => <option key={env} value={env}>{env}</option>)}
                  </select>
                )}
                <select className={m.select} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                  <option value="status">Sort: needs attention</option>
                  <option value="uptime">Sort: lowest success rate</option>
                  <option value="slowest">Sort: slowest (p95)</option>
                  <option value="failures">Sort: most failures (30d)</option>
                  <option value="recent">Sort: last run</option>
                  <option value="name">Sort: name</option>
                </select>
              </div>
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
                {visible.length === 0 && <li className={m.noMatch}>No monitors match these filters. <button className={m.linkButton} onClick={() => { setFilter('all'); setSearch(''); setEnvFilter('all'); }}>Clear filters</button></li>}
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
                            <Link href={`/monitors/${mon.id}`} className={`${m.name} ${m.nameLink}`}>{mon.name || mon.slug}</Link>
                            <span className={m.slug}>{pid === 'all' ? `${projectLabel(mon)} · ` : ''}{mon.slug}{mon.environment ? ` · ${mon.environment}` : ''}</span>
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
                          <div>
                            <dt>Success 7d</dt>
                            <dd className={rateTone(mon.stats.windows['7d'].uptime)}>{pct(mon.stats.windows['7d'].uptime)}</dd>
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
                              {mon.pingUrls.length > 0 && (
                                <div className={m.detailLine}><span>Ping URLs</span>
                                  <ul className={m.urlList}>{mon.pingUrls.map((u) => <li key={u} className={m.mono}>{u}</li>)}</ul>
                                </div>
                              )}
                              <div className={m.detailActions}>
                                <Link href={`/monitors/${mon.id}`} className={m.editButton}>Open monitor</Link>
                                <button type="button" className={m.editButton} onClick={() => openEdit(mon)}>Edit monitor</button>
                                <button type="button" className={m.dangerLink} onClick={() => deleteMonitor(mon)}>
                                  <Icon name="trash" size={13} /> Delete
                                </button>
                              </div>
                            </div>
                            <StatsPanel stats={mon.stats} now={now} range={range} />
                            <CheckInHistory projectId={scopeOf(mon)} monitorId={mon.id} now={now} refreshKey={String(mon.lastRunAt)} />
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
        <MonitorDialog
          projects={projects}
          monitor={editing}
          defaultProjectId={pid === 'all' ? undefined : pid}
          onClose={closeDialog}
          onSaved={async () => { closeDialog(); setFilter('all'); await loadMonitors(pid, { quiet: true }); }}
        />
      )}
    </>
  );
}
