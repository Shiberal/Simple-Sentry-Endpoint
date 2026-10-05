import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const pct = (v) => (v == null ? '-' : `${v}%`);
const rateTone = (v) => (v == null ? '' : v >= 99 ? m.textOk : v >= 95 ? m.textWarn : m.textBad);

const RANGE_OPTIONS = ['24h', '7d', '30d', '90d'];
const CHART_MODES = [['uptime', 'Uptime'], ['latency', 'Response time'], ['failures', 'Runs']];

function bucketLabel(iso, range) {
  const d = new Date(iso);
  if (range === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (range === '7d') return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Interactive chart over a bucketed series: hover for exact values. */
function Chart({ series, range, mode, height = 150 }) {
  const [hover, setHover] = useState(null);
  // Draw at the real pixel width so axis text stays readable at any size
  const wrapRef = useRef(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padL = 40;
  const padB = 18;
  const padT = 8;
  const H = height;
  const n = series.length;
  const step = (W - padL) / Math.max(1, n);
  const x = (i) => padL + step * i + step / 2;

  let max = 100;
  if (mode === 'latency') max = Math.max(10, ...series.map((d) => d.p95Ms || d.avgMs || 0));
  if (mode === 'failures') max = Math.max(1, ...series.map((d) => d.ok + d.error));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const line = (key) => {
    let path = '';
    let pen = false;
    series.forEach((d, i) => {
      if (d[key] == null) { pen = false; return; }
      path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)} `;
      pen = true;
    });
    return path;
  };
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const fmtTick = (v) => (mode === 'uptime' ? `${Math.round(v)}%` : mode === 'latency' ? fmtDuration(v) : Math.round(v));
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - padL) / 110))));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.min(n - 1, Math.max(0, Math.floor((px - padL) / step))));
  };
  const h = hover != null ? series[hover] : null;

  return (
    <div className={m.chartWrap} ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className={m.chart} role="img" aria-label={`${mode} over the last ${range}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className={m.gridLine} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className={m.axisText}>{fmtTick(t)}</text>
          </g>
        ))}
        {series.map((d, i) => i % labelEvery === 0 && (
          <text key={d.date} x={x(i)} y={H - 4} textAnchor="middle" className={m.axisText}>{bucketLabel(d.date, range)}</text>
        ))}
        {mode === 'failures' && series.map((d, i) => {
          const bw = Math.max(2, step * 0.7);
          const okH = (H - padT - padB) * (d.ok / max);
          const errH = (H - padT - padB) * (d.error / max);
          return (
            <g key={d.date}>
              <rect x={x(i) - bw / 2} y={H - padB - okH} width={bw} height={okH} className={m.fillOk} />
              <rect x={x(i) - bw / 2} y={H - padB - okH - errH} width={bw} height={errH} className={m.fillBad} />
            </g>
          );
        })}
        {mode === 'uptime' && (
          <>
            {series.map((d, i) => d.uptime != null && d.uptime < 90 && <rect key={d.date} x={x(i) - step / 2} y={padT} width={step} height={H - padT - padB} className={m.fillBadSoft} />)}
            <path d={line('uptime')} className={m.lineOk} fill="none" />
            {series.map((d, i) => d.uptime != null && <circle key={d.date} cx={x(i)} cy={y(d.uptime)} r={n > 40 ? 1.5 : 2.5} className={d.error ? m.dotBad : m.dotOk} />)}
          </>
        )}
        {mode === 'latency' && (
          <>
            <path d={line('p95Ms')} className={m.lineWarn} fill="none" strokeDasharray="4 3" />
            <path d={line('avgMs')} className={m.lineInfo} fill="none" />
          </>
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} className={m.cursor} />}
      </svg>
      {h && (
        <div className={m.tooltip} style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{bucketLabel(h.date, range)}</strong>
          <span>{h.ok + h.error} run{h.ok + h.error === 1 ? '' : 's'} · {h.error} failed</span>
          <span>Uptime {pct(h.uptime)}</span>
          <span>Avg {fmtDuration(h.avgMs)}{h.p95Ms != null && <> · p95 {fmtDuration(h.p95Ms)}</>}</span>
        </div>
      )}
      {mode === 'latency' && <p className={m.legend}><span className={m.keyInfo} /> Average <span className={m.keyWarn} /> p95 (successful runs)</p>}
      {mode === 'failures' && <p className={m.legend}><span className={m.keyOk} /> Succeeded <span className={m.keyBad} /> Failed</p>}
    </div>
  );
}

function ChartPanel({ series, range, modes = CHART_MODES, height }) {
  const [mode, setMode] = useState(modes[0][0]);
  return (
    <div>
      <div className={m.segmented} role="tablist" aria-label="Chart">
        {modes.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} className={`${m.segment} ${mode === k ? m.segmentOn : ''}`} onClick={() => setMode(k)}>{label}</button>
        ))}
      </div>
      <Chart series={series} range={range} mode={mode} height={height} />
    </div>
  );
}

function StatsPanel({ stats, now, range }) {
  const rows = [['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days']];
  const inc = stats.incidents;
  return (
    <div>
      <h3 className={m.detailTitle}>Stats</h3>
      <table className={m.runs}>
        <thead><tr><th>Window</th><th>Uptime</th><th>Runs</th><th>Failed</th><th>Avg</th><th>p95</th></tr></thead>
        <tbody>
          {rows.map(([k, label]) => {
            const w = stats.windows[k];
            return (
              <tr key={k}>
                <td>{label}</td>
                <td className={`${m.mono} ${rateTone(w.uptime)}`}>{pct(w.uptime)}</td>
                <td className={m.mono}>{w.runs}</td>
                <td className={m.mono}>{w.error}</td>
                <td className={m.mono}>{fmtDuration(w.avgMs)}</td>
                <td className={m.mono}>{fmtDuration(w.p95Ms)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={m.detailLine}>
        <span>Streak</span>
        {stats.streak
          ? <span className={stats.streak.status === 'ok' ? m.textOk : m.textBad}>{stats.streak.count} {stats.streak.status === 'ok' ? 'successful' : 'failed'} in a row, since {ago(stats.streak.since, now)}</span>
          : 'No runs yet'}
      </p>
      <p className={m.detailLine}>
        <span>Incidents</span>
        {inc.count30d === 0
          ? 'None in 30 days'
          : <>{inc.count30d} in 30 days{inc.mttrMs != null && <> · avg recovery {fmtDuration(inc.mttrMs)}</>}{inc.longestMs != null && <> · longest {fmtDuration(inc.longestMs)}</>}</>}
      </p>
      {inc.recent.length > 0 && (
        <ul className={m.incidentList}>
          {inc.recent.slice(0, 5).map((i) => (
            <li key={String(i.startedAt)} title={new Date(i.startedAt).toLocaleString()}>
              <span className={i.ongoing ? m.textBad : m.faint}>{i.ongoing ? 'Ongoing' : 'Resolved'}</span> {ago(i.startedAt, now)} · {i.ongoing ? 'down' : 'lasted'} {fmtDuration(i.durationMs)} · {i.failedRuns} failed run{i.failedRuns === 1 ? '' : 's'}
            </li>
          ))}
        </ul>
      )}
      <ChartPanel series={stats.daily} range={range} />
      <p className={m.faint}>Rates count runs that reported; missed runs show as health, not here.</p>
    </div>
  );
}

function CheckInHistory({ projectId, monitorId, now, refreshKey }) {
  const [status, setStatus] = useState('all');
  const [days, setDays] = useState(0);
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async (before) => {
    setBusy(true);
    setErr('');
    try {
      const q = new URLSearchParams({ monitorId: String(monitorId), limit: '25' });
      if (status !== 'all') q.set('status', status);
      if (days) q.set('days', String(days));
      if (before) q.set('before', String(before));
      const res = await fetch(`/api/projects/${projectId}/monitors/checkins?${q}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Could not load check-ins');
      setRows((prev) => (before ? [...prev, ...j.checkIns] : j.checkIns));
      setNext(j.nextBefore);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [projectId, monitorId, status, days]);

  useEffect(() => { load(null); }, [load, refreshKey]);

  return (
    <div>
      <h3 className={m.detailTitle}>Check-ins</h3>
      <div className={m.filterRow}>
        <div className={m.segmented}>
          {[['all', 'All'], ['error', 'Failed'], ['ok', 'Succeeded']].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={status === k} className={`${m.segment} ${status === k ? m.segmentOn : ''}`} onClick={() => setStatus(k)}>{label}</button>
          ))}
        </div>
        <select className={m.select} value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))} aria-label="Time range">
          <option value={0}>All time</option>
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      {err && <p className={m.textBad}>{err}</p>}
      {!busy && !rows.length && !err ? (
        <p className={m.faint}>No check-ins match.</p>
      ) : (
        <table className={m.runs}>
          <thead><tr><th>When</th><th>Result</th><th>Took</th><th>Source</th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const failed = (c.results || []).filter((r) => !r.ok);
              const expandable = !!c.results?.length;
              return (
                <Fragment key={c.id}>
                  <tr className={expandable ? m.clickRow : ''} onClick={expandable ? () => setOpen(open === c.id ? null : c.id) : undefined}>
                    <td title={new Date(c.createdAt).toLocaleString()}>{ago(c.createdAt, now)}</td>
                    <td><span className={`${m.runResult} ${c.status === 'ok' ? m.textOk : c.status === 'error' ? m.textBad : m.textInfo}`}>{c.status === 'in_progress' ? 'started' : c.status}</span>
                      {failed.length > 0 && <span className={m.faint}> {failed.map((r) => r.status || r.error).join(', ')}</span>}
                    </td>
                    <td className={m.mono}>{fmtDuration(c.durationMs)}</td>
                    <td>{c.source === 'server_http' ? 'Server ping' : 'SDK'}{expandable ? (open === c.id ? ' ▾' : ' ▸') : ''}</td>
                  </tr>
                  {open === c.id && (
                    <tr><td colSpan={4} className={m.resultCell}>
                      <div className={m.faint}>{new Date(c.createdAt).toLocaleString()}{c.environment ? ` · ${c.environment}` : ''}</div>
                      {c.results.map((r, i) => (
                        <div key={i} className={m.mono}>
                          <span className={r.ok ? m.textOk : m.textBad}>{r.ok ? 'OK' : 'FAIL'}</span> {r.url} {r.status ? `· HTTP ${r.status}` : ''}{r.error ? ` · ${r.error}` : ''}{r.durationMs != null ? ` · ${fmtDuration(r.durationMs)}` : ''}
                        </div>
                      ))}
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
      {next && <button type="button" className={m.editButton} disabled={busy} onClick={() => load(next)}>{busy ? 'Loading…' : 'Load older'}</button>}
    </div>
  );
}

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
  const [range, setRange] = useState('30d');
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [sort, setSort] = useState('status');
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
      const res = await fetch(`/api/projects/${projectId}/monitors?range=${range}`);
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
                <ChartPanel series={summary.stats.daily} range={range} height={170} modes={[CHART_MODES[0], CHART_MODES[2]]} />
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
                                <button type="button" className={m.editButton} onClick={() => openEdit(mon)}>Edit monitor</button>
                                <button type="button" className={m.dangerLink} onClick={() => deleteMonitor(mon)}>
                                  <Icon name="trash" size={13} /> Delete
                                </button>
                              </div>
                            </div>
                            <StatsPanel stats={mon.stats} now={now} range={range} />
                            <CheckInHistory projectId={pid} monitorId={mon.id} now={now} refreshKey={String(mon.lastRunAt)} />
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
