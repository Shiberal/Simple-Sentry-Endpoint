import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import MonitorDialog from '@/components/monitors/MonitorDialog';
import {
  CHART_MODES, ChartPanel, CheckInHistory, HEALTH, Heatmap, History, MonitorSidebar, projectLabel, scopeOf, RANGE_OPTIONS, REFRESH_MS, ago, fmtDuration, monitorApi, pct, rateTone, until
} from '@/components/monitors/shared';
import styles from '@/styles/Dashboard.module.css';
import m from '@/styles/Monitors.module.css';

function IncidentStrip({ incidents, selected, onSelect, now }) {
  const DAY = 86400000;
  const start = now - 30 * DAY;
  return (
    <div className={m.strip} role="img" aria-label="Incidents over the last 30 days">
      {incidents.map((i) => {
        const from = Math.max(start, new Date(i.startedAt).getTime());
        const to = i.endedAt ? new Date(i.endedAt).getTime() : now;
        const left = ((from - start) / (30 * DAY)) * 100;
        const width = Math.max(0.6, ((to - from) / (30 * DAY)) * 100);
        const key = String(i.startedAt);
        return (
          <button
            key={key}
            type="button"
            className={`${m.stripBar} ${i.ongoing ? m.stripOngoing : ''} ${selected === key ? m.stripSelected : ''}`}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={`${new Date(i.startedAt).toLocaleString()} · ${fmtDuration(i.durationMs)}`}
            onClick={() => onSelect(key)}
            aria-label={`Incident from ${new Date(i.startedAt).toLocaleString()}`}
          />
        );
      })}
      <span className={m.stripLabel}>30d ago</span>
      <span className={`${m.stripLabel} ${m.stripLabelEnd}`}>now</span>
    </div>
  );
}

function IncidentDetail({ monitor, incident, now }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    const q = new URLSearchParams({
      monitorId: String(monitor.id),
      limit: '100',
      from: new Date(incident.startedAt).toISOString(),
      to: new Date(incident.endedAt || Date.now()).toISOString()
    });
    fetch(`/api/projects/${scopeOf(monitor)}/monitors/checkins?${q}`)
      .then((r) => r.json())
      .then((j) => setRows(j.checkIns || []))
      .catch(() => setRows([]));
  }, [monitor.id, monitor.projectId, incident.startedAt, incident.endedAt]);

  const failures = (rows || []).filter((c) => c.status === 'error');
  const reasons = {};
  failures.forEach((c) => {
    const why = (c.results || []).filter((r) => !r.ok).map((r) => r.status ? `HTTP ${r.status}` : r.error || 'failed').join(', ') || 'Reported failure';
    reasons[why] = (reasons[why] || 0) + 1;
  });

  return (
    <div className={m.incidentDetail}>
      <h3 className={m.detailTitle}>Incident detail</h3>
      <p className={m.detailLine}><span>Started</span> {new Date(incident.startedAt).toLocaleString()} ({ago(incident.startedAt, now)})</p>
      <p className={m.detailLine}><span>{incident.ongoing ? 'Status' : 'Resolved'}</span>{incident.ongoing ? <span className={m.textBad}>Ongoing</span> : new Date(incident.endedAt).toLocaleString()}</p>
      <p className={m.detailLine}><span>Duration</span> {fmtDuration(incident.durationMs)} · {incident.failedRuns} failed run{incident.failedRuns === 1 ? '' : 's'}</p>
      {Object.keys(reasons).length > 0 && (
        <p className={m.detailLine}><span>Causes</span> {Object.entries(reasons).map(([why, n]) => `${why} ×${n}`).join(' · ')}</p>
      )}
      {rows == null ? <p className={m.faint}>Loading runs…</p> : (
        <table className={m.runs}>
          <thead><tr><th>When</th><th>Result</th><th>Took</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td title={new Date(c.createdAt).toLocaleString()}>{new Date(c.createdAt).toLocaleTimeString()}</td>
                <td className={c.status === 'error' ? m.textBad : c.status === 'ok' ? m.textOk : m.textInfo}>{c.status}</td>
                <td className={m.mono}>{fmtDuration(c.durationMs)}</td>
                <td className={m.faint}>{(c.results || []).filter((r) => !r.ok).map((r) => `${r.url} ${r.status || r.error || ''}`).join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function MonitorDetailPage() {
  const router = useRouter();
  const id = router.query.id;
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [monitor, setMonitor] = useState(null);
  const [range, setRange] = useState('30d');
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showAllIncidents, setShowAllIncidents] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/monitors/${id}?range=${range}`);
    if (res.status === 404) { setNotFound(true); return; }
    const j = await res.json();
    if (!res.ok) { setError(j.error || 'Could not load monitor'); return; }
    setMonitor(j.monitor);
    setNow(Date.now());
  }, [id, range]);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me').then((r) => r.json());
      if (!me?.user) { router.push('/login'); return; }
      setUser(me.user);
      const pr = await fetch('/api/projects').then((r) => r.json());
      setProjects(pr.projects || []);
    })();
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const t = setInterval(tick, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const act = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!user) return <div className={styles.container}>Loading…</div>;
  if (notFound) {
    return (
      <div className={styles.container}>
        <main className={m.page}><div className={m.empty}><h2 className={m.emptyTitle}>Monitor not found</h2><Link href="/monitors" className={m.editButton}>Back to monitors</Link></div></main>
      </div>
    );
  }

  const h = monitor ? HEALTH[monitor.health] || HEALTH.unknown : null;
  const stats = monitor?.stats;
  const w = stats?.windows?.[range === '24h' ? '24h' : range === '7d' ? '7d' : '30d'];
  const incidents = stats?.incidents?.recent || [];
  const selected = incidents.find((i) => String(i.startedAt) === selectedIncident) || null;
  const paused = monitor?.status === 'paused';

  return (
    <>
      <Head><title>{monitor ? `${monitor.name || monitor.slug} - Monitors` : 'Monitor'} - Sentry Monitor</title></Head>
      <div className={styles.container}>
        <nav className={styles.navSidebar} aria-label="Primary">
          <Link href="/projects" style={{ textDecoration: 'none' }}><div className={styles.navItem} title="Projects"><Icon name="folder" size={18} /><div className={styles.navItemTooltip}>Projects</div></div></Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}><div className={styles.navItem} title="Global Dashboard"><Icon name="dashboard" size={18} /><div className={styles.navItemTooltip}>Global Dashboard</div></div></Link>
          <Link href="/performance" style={{ textDecoration: 'none' }}><div className={styles.navItem} title="Performance"><Icon name="activity" size={18} /><div className={styles.navItemTooltip}>Performance</div></div></Link>
          <Link href="/monitors" style={{ textDecoration: 'none' }}><div className={`${styles.navItem} ${styles.navItemActive}`} title="Monitors"><Icon name="clock" size={18} /><div className={styles.navItemTooltip}>Monitors</div></div></Link>
          <div className={styles.navDivider}></div>
          <Link href="/profile" style={{ textDecoration: 'none' }}><div className={styles.navItem} title="Profile"><Icon name="user" size={18} /><div className={styles.navItemTooltip}>Your Profile</div></div></Link>
        </nav>
        <div className={styles.main}>
          <header className={styles.header}>
            <div className={styles.headerContent}>
              <h1 className={styles.logo}>
                <Link href="/monitors" className={m.crumb}>Monitors</Link>
                <span className={m.crumbSep}>/</span>
                {monitor ? (monitor.name || monitor.slug) : '…'}
              </h1>
              {monitor && (
                <div className={styles.headerActions}>
                  {monitor.pingUrls.length > 0 && !paused && (
                    <button type="button" className={styles.headerButton} disabled={busy} onClick={() => act(() => monitorApi.run(monitor))}>
                      <Icon name="play" size={14} /> <span className={m.headerLabel}>Run now</span>
                    </button>
                  )}
                  <button type="button" className={styles.headerButton} disabled={busy} onClick={() => act(() => monitorApi.setPaused(monitor, !paused))}>
                    <Icon name={paused ? 'play' : 'pause'} size={14} /> <span className={m.headerLabel}>{paused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button type="button" className={styles.headerButton} onClick={() => setEditing(true)}>Edit</button>
                  <button
                    type="button"
                    className={styles.headerButton}
                    onClick={async () => {
                      if (!window.confirm(`Delete monitor "${monitor.slug}"? Its check-in history is deleted with it.`)) return;
                      try { await monitorApi.remove(monitor); router.push('/monitors'); } catch (e) { setError(e.message); }
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className={m.split}>
          <MonitorSidebar activeId={monitor?.id ?? parseInt(id, 10)} scope={monitor ? scopeOf(monitor) : null} />
          <main className={m.page}>
            {error && <div className={m.error} role="alert">{error}</div>}
            {!monitor ? <div className={m.skeletonList} aria-busy="true"><div className={m.skeleton} /></div> : (
              <>
                <section className={m.detailHead}>
                  <span className={m.slug}>{projectLabel(monitor)} · {monitor.slug}{monitor.environment ? ` · ${monitor.environment}` : ''}</span>
                  <span className={m.faint}>{monitor.healthReason}</span>
                </section>

                <section className={m.beat} aria-label="Recent runs">
                  <div className={m.beatBar}><History history={monitor.history || []} slots={60} /></div>
                  <span className={`${m.beatBadge} ${m[`tone_${h.tone}`]}`}>{h.label}</span>
                </section>

                {monitor.alertState === 'alerting' && (
                  <div className={m.banner} role="status">
                    <Icon name="alert" size={18} />
                    <div><strong>Incident in progress.</strong> {monitor.alertsEnabled ? `An alert was sent ${ago(monitor.alertedAt, now)}; you will be notified again when it recovers.` : 'Alerts are off for this monitor.'}</div>
                  </div>
                )}

                <section className={m.summary} aria-label="Key numbers">
                  <div className={`${m.tile} ${m.tileStatic}`}><span className={`${m.tileValue} ${rateTone(w.uptime)}`}>{pct(w.uptime)}</span><span className={m.tileLabel}>Success, {range === '90d' ? '30d' : range} · {w.runs} runs</span></div>
                  <div className={`${m.tile} ${m.tileStatic}`}><span className={m.tileValue}>{fmtDuration(w.avgMs)}</span><span className={m.tileLabel}>Avg run · p95 {fmtDuration(w.p95Ms)}</span></div>
                  <div className={`${m.tile} ${m.tileStatic}`}><span className={`${m.tileValue} ${stats.streak?.status === 'error' ? m.textBad : ''}`}>{stats.streak ? stats.streak.count : '-'}</span><span className={m.tileLabel}>{stats.streak ? `${stats.streak.status === 'ok' ? 'ok' : 'failed'} in a row` : 'No runs yet'}</span></div>
                  <div className={`${m.tile} ${m.tileStatic}`}><span className={m.tileValue}>{stats.incidents.count30d}</span><span className={m.tileLabel}>Incidents, 30d{stats.incidents.mttrMs != null ? ` · ${fmtDuration(stats.incidents.mttrMs)} to recover` : ''}</span></div>
                  <div className={`${m.tile} ${m.tileStatic}`}><span className={m.tileValue}>{ago(monitor.lastRunAt, now)}</span><span className={m.tileLabel}>Last run{monitor.lastDurationMs != null ? ` · ${fmtDuration(monitor.lastDurationMs)}` : ''}</span></div>
                  <div className={`${m.tile} ${m.tileStatic}`}><span className={m.tileValue}>{paused ? 'paused' : until(monitor.nextRunAt, now)}</span><span className={m.tileLabel}>Next run</span></div>
                </section>

                <section className={m.overview}>
                  <div className={m.overviewHead}>
                    <h2 className={m.detailTitle}>Trends</h2>
                    <div className={m.segmented} role="group" aria-label="Range">
                      {RANGE_OPTIONS.map((r) => (
                        <button key={r} type="button" aria-pressed={range === r} className={`${m.segment} ${range === r ? m.segmentOn : ''}`} onClick={() => setRange(r)}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <ChartPanel series={stats.daily} range={range} height={190} modes={[CHART_MODES[1], CHART_MODES[0], CHART_MODES[2]]} />
                </section>

                <section className={m.overview}>
                  <div className={m.overviewHead}>
                    <h2 className={m.detailTitle}>Daily history</h2>
                    {selectedDay && <button type="button" className={m.linkButton} onClick={() => setSelectedDay(null)}>Clear day</button>}
                  </div>
                  <Heatmap projectId={scopeOf(monitor)} monitorId={monitor.id} selected={selectedDay} onSelect={setSelectedDay} refreshKey={String(monitor.lastRunAt)} />
                </section>

                <section className={m.overview} id="incidents">
                  <h2 className={m.detailTitle}>Incident timeline</h2>
                  {incidents.length === 0 ? <p className={m.faint}>No incidents in the last 30 days.</p> : (
                    <>
                      <IncidentStrip incidents={incidents} selected={selectedIncident} onSelect={setSelectedIncident} now={now} />
                      {selected && <IncidentDetail monitor={monitor} incident={selected} now={now} />}
                      <ul className={m.incidentRows}>
                        {(showAllIncidents ? incidents : incidents.slice(0, 6)).map((i) => {
                          const key = String(i.startedAt);
                          return (
                            <li key={key}>
                              <button type="button" className={`${m.incidentRow} ${selectedIncident === key ? m.incidentRowOn : ''}`} onClick={() => setSelectedIncident(selectedIncident === key ? null : key)}>
                                <span className={i.ongoing ? m.textBad : m.textOk}>{i.ongoing ? 'Ongoing' : 'Resolved'}</span>
                                <span>{new Date(i.startedAt).toLocaleString()}</span>
                                <span className={m.faint}>{i.ongoing ? 'down for' : 'lasted'} {fmtDuration(i.durationMs)} · {i.failedRuns} failed run{i.failedRuns === 1 ? '' : 's'}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {incidents.length > 6 && <button type="button" className={m.linkButton} onClick={() => setShowAllIncidents(!showAllIncidents)}>{showAllIncidents ? 'Show fewer' : `Show all ${incidents.length}`}</button>}
                    </>
                  )}
                </section>

                <div className={m.detailGrid}>
                  <section className={m.overview}>
                    <CheckInHistory projectId={scopeOf(monitor)} monitorId={monitor.id} now={now} refreshKey={String(monitor.lastRunAt)} day={selectedDay} />
                  </section>
                  <div className={m.sideStack}>
                    <section className={m.overview}>
                      <h3 className={m.detailTitle}>Configuration</h3>
                      <p className={m.detailLine}><span>Schedule</span> {monitor.scheduleText ? <>{monitor.scheduleText}{monitor.schedule && monitor.scheduleText !== monitor.schedule && <code className={m.code}>{monitor.schedule}</code>}</> : 'None (SDK check-ins only)'}</p>
                      <p className={m.detailLine}><span>Slug</span> <code className={m.code}>{monitor.slug}</code></p>
                      {monitor.pingUrls.length > 0 && (
                        <div className={m.detailLine}><span>Ping URLs</span><ul className={m.urlList}>{monitor.pingUrls.map((u) => <li key={u} className={m.mono}>{u}</li>)}</ul></div>
                      )}
                      <p className={m.detailLine}><span>Created</span> {new Date(monitor.createdAt).toLocaleDateString()}</p>
                    </section>
                    <section className={m.overview} id="alerts">
                      <h3 className={m.detailTitle}>Alerts</h3>
                      {!monitor.alertsEnabled ? <p className={m.faint}>Alerts are off.</p> : (
                        <>
                          <p className={m.detailLine}><span>Trigger</span> {monitor.failureThreshold} failed run{monitor.failureThreshold === 1 ? '' : 's'} in a row, then again on recovery</p>
                          <p className={m.detailLine}><span>Email</span> {monitor.alertEmails || '-'}</p>
                          <p className={m.detailLine}><span>Slack</span> {monitor.alertSlackUrl ? 'configured' : '-'}</p>
                          <p className={m.detailLine}><span>Webhook</span> {monitor.alertWebhookUrl ? 'configured' : '-'}</p>
                          <p className={m.faint}>Telegram is used too when the project has a chat set.</p>
                        </>
                      )}
                      <button type="button" className={m.editButton} onClick={() => setEditing(true)}>Edit alerts</button>
                    </section>
                    {/* Resource usage (CPU, memory, disk) is being built separately; it mounts here. */}
                    <section className={`${m.overview} ${m.slot}`} id="resource-usage" data-slot="resource-usage">
                      <h3 className={m.detailTitle}>Resource usage</h3>
                      <p className={m.faint}>CPU, memory and disk reported by this monitor will appear here once reporting is enabled.</p>
                    </section>
                  </div>
                </div>
              </>
            )}
          </main>
          </div>
        </div>
      </div>
      {editing && monitor && (
        <MonitorDialog projects={projects} monitor={monitor} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await load(); }} />
      )}
    </>
  );
}
