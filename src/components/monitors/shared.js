import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import m from '@/styles/Monitors.module.css';

export const HEALTH = {
  ok: { label: 'Healthy', tone: 'ok' },
  failing: { label: 'Failing', tone: 'bad' },
  missed: { label: 'Missed', tone: 'warn' },
  running: { label: 'Running', tone: 'info' },
  paused: { label: 'Paused', tone: 'muted' },
  pending: { label: 'Waiting', tone: 'muted' },
  unknown: { label: 'No schedule', tone: 'muted' }
};

export const PRESETS = [
  ['*/5 * * * *', 'Every 5 minutes'],
  ['*/15 * * * *', 'Every 15 minutes'],
  ['0 * * * *', 'Every hour'],
  ['0 2 * * *', 'Daily at 02:00'],
  ['0 9 * * 1-5', 'Weekdays at 09:00']
];

export const REFRESH_MS = 15000;

export function fmtDuration(ms) {
  if (ms == null) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${String(sec).padStart(2, '0')}s`;
}

export function span(ms) {
  const abs = Math.abs(ms);
  if (abs < 60000) return 'under a minute';
  const min = Math.round(abs / 60000);
  if (min < 60) return `${min}m`;
  const hours = Math.round(abs / 3600000);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(abs / 86400000)}d`;
}

export function ago(date, now) {
  if (!date) return 'never';
  const ms = now - new Date(date).getTime();
  return ms < 60000 ? 'just now' : `${span(ms)} ago`;
}

export function until(date, now) {
  if (!date) return '-';
  const ms = new Date(date).getTime() - now;
  return ms <= 0 ? 'due now' : ms < 60000 ? 'in under a minute' : `in ${span(ms)}`;
}

/** Last 30 runs as a strip of bars: colour = outcome, height = duration relative to the slowest. */
export const pct = (v) => (v == null ? '-' : `${v}%`);
export const rateTone = (v) => (v == null ? '' : v >= 99 ? m.textOk : v >= 95 ? m.textWarn : m.textBad);

export const RANGE_OPTIONS = ['24h', '7d', '30d', '90d'];
export const CHART_MODES = [['uptime', 'Uptime'], ['latency', 'Response time'], ['failures', 'Runs']];

export function bucketLabel(iso, range) {
  const d = new Date(iso);
  if (range === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (range === '7d') return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Interactive chart over a bucketed series: hover for exact values. */
export function Chart({ series, range, mode, height = 150 }) {
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
  let min = 0;
  if (mode === 'uptime') {
    const vals = series.map((d) => d.uptime).filter((v) => v != null);
    min = vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10) : 0;
    if (min >= 100) min = 90;
  }
  if (mode === 'latency') max = Math.max(10, ...series.map((d) => d.p95Ms || d.avgMs || 0));
  if (mode === 'failures') max = Math.max(1, ...series.map((d) => d.ok + d.error));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
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
  const ticks = [0, 0.5, 1].map((f) => min + (max - min) * f);
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

export function ChartPanel({ series, range, modes = CHART_MODES, height }) {
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

export function StatsPanel({ stats, now, range }) {
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

export function CheckInHistory({ projectId, monitorId, now, refreshKey, day = null }) {
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
      if (day) {
        const start = new Date(`${day}T00:00:00`);
        q.set('from', start.toISOString());
        q.set('to', new Date(start.getTime() + 86400000 - 1).toISOString());
      } else if (days) q.set('days', String(days));
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
  }, [projectId, monitorId, status, days, day]);

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
        <select className={m.select} value={days} disabled={!!day} onChange={(e) => setDays(parseInt(e.target.value, 10))} aria-label="Time range">
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

export function History({ history: all, slots = 30 }) {
  const SLOTS = slots;
  const history = all.slice(-SLOTS);
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


async function send(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Request failed');
  return j;
}

/** Actions on one monitor; each throws an Error with a readable message. */
export const monitorApi = {
  run: (mon) => send(`/api/projects/${mon.projectId}/monitors/ping`, { method: 'POST', body: JSON.stringify({ monitorId: mon.id }) }),
  setPaused: (mon, paused) => send(`/api/projects/${mon.projectId}/monitors`, { method: 'PATCH', body: JSON.stringify({ monitorId: mon.id, status: paused ? 'paused' : 'active' }) }),
  remove: (mon) => send(`/api/projects/${mon.projectId}/monitors?monitorId=${mon.id}`, { method: 'DELETE' })
};

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 0 = no runs, 1 = all ok, 2 = under 5% failed, 3 = under 25%, 4 = 25%+ */
function dayLevel(d) {
  const total = d ? d.ok + d.error : 0;
  if (!total) return 0;
  const rate = d.error / total;
  return rate === 0 ? 1 : rate < 0.05 ? 2 : rate < 0.25 ? 3 : 4;
}

const WEEKS = 53;

/** GitHub-style year grid: one cell per local day, colour = share of failed runs. Click a day to select it. */
export function Heatmap({ projectId, monitorId, selected, onSelect, refreshKey }) {
  const [days, setDays] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ monitorId: String(monitorId), days: String(WEEKS * 7), tzOffset: String(-new Date().getTimezoneOffset()) });
    fetch(`/api/projects/${projectId}/monitors/heatmap?${q}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!live) return;
        if (!ok) throw new Error(j.error || 'Could not load history');
        setDays(Object.fromEntries(j.days.map((d) => [d.date, d])));
      })
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [projectId, monitorId, refreshKey]);

  if (err) return <p className={m.textBad}>{err}</p>;
  if (!days) return <p className={m.faint}>Loading history…</p>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((WEEKS - 1) * 7 + today.getDay()));
  const cells = [];
  for (let i = 0; i < WEEKS * 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > today) break;
    cells.push({ date: d, key: dayKey(d), data: days[dayKey(d)] });
  }
  const months = [];
  cells.forEach((c, i) => {
    if (i % 7 === 0 && (i === 0 || c.date.getMonth() !== cells[i - 7].date.getMonth())) months.push({ week: i / 7, label: c.date.toLocaleString([], { month: 'short' }) });
  });
  const failedDays = Object.values(days).filter((d) => d.error > 0).length;
  const runs = Object.values(days).reduce((n, d) => n + d.ok + d.error, 0);
  const sel = selected ? days[selected] : null;

  return (
    <div>
      <p className={m.faint}>{runs.toLocaleString()} runs in the last year · {failedDays} day{failedDays === 1 ? '' : 's'} with failures</p>
      <div className={m.heatScroll}>
        <div className={m.heatMonths} style={{ gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, 12px)` }}>
          {months.map((mo) => <span key={mo.week} style={{ gridColumn: mo.week + 1 }}>{mo.label}</span>)}
        </div>
        <div className={m.heatGrid} role="group" aria-label="Daily results, last year">
          {cells.map((c, i) => {
            const total = c.data ? c.data.ok + c.data.error : 0;
            const label = `${c.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}: ${total ? `${c.data.error} failed of ${total} runs` : 'no runs'}`;
            return (
              <button
                key={c.key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={selected === c.key}
                className={`${m.heatCell} ${m[`heat${dayLevel(c.data)}`]} ${selected === c.key ? m.heatSel : ''}`}
                style={i < 7 ? { gridRow: c.date.getDay() + 1, gridColumn: 1 } : undefined}
                onClick={() => onSelect(selected === c.key ? null : c.key)}
              />
            );
          })}
        </div>
      </div>
      <div className={m.heatLegend}>
        <span>Healthy</span>
        {[1, 2, 3, 4].map((l) => <span key={l} className={`${m.heatCell} ${m[`heat${l}`]}`} />)}
        <span>Failing</span>
      </div>
      {selected && (
        <p className={m.detailLine}>
          <strong>{new Date(`${selected}T00:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
          {sel
            ? <> · {sel.ok + sel.error} runs · <span className={sel.error ? m.textBad : m.textOk}>{sel.error} failed</span> · {Math.round((sel.ok / (sel.ok + sel.error)) * 1000) / 10}% success{sel.avgMs != null ? ` · avg ${fmtDuration(sel.avgMs)}` : ''}</>
            : ' · no runs'}
        </p>
      )}
    </div>
  );
}


/** Left rail on the monitor page: every monitor with its 24h success badge and a mini run strip, searchable. */
export function MonitorSidebar({ activeId }) {
  const [monitors, setMonitors] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetch('/api/monitors').then((r) => r.json()).then((j) => live && j.monitors && setMonitors(j.monitors)).catch(() => {});
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { live = false; clearInterval(t); };
  }, []);

  const term = q.trim().toLowerCase();
  const shown = (monitors || []).filter((x) => !term || `${x.name || ''} ${x.slug} ${x.project?.name || ''}`.toLowerCase().includes(term));

  return (
    <aside className={m.sideList} aria-label="Monitors">
      <input className={m.sideSearch} type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search monitors" />
      <ul className={m.sideItems}>
        {shown.map((x) => {
          const up = x.stats?.windows?.['24h']?.uptime;
          return (
            <li key={x.id}>
              <Link href={`/monitors/${x.id}`} className={`${m.sideItem} ${x.id === activeId ? m.sideItemOn : ''}`}>
                <span className={`${m.sideBadge} ${up == null ? m.sideBadgeNone : up >= 99 ? m.sideBadgeOk : up >= 95 ? m.sideBadgeWarn : m.sideBadgeBad}`}>{up == null ? '–' : `${Math.round(up)}%`}</span>
                <span className={m.sideName}>{x.name || x.slug}<small>{x.project?.name}</small></span>
                <span className={m.sideStrip}><History history={x.history || []} slots={12} /></span>
              </Link>
            </li>
          );
        })}
        {monitors && !shown.length && <li className={m.faint}>No monitors match.</li>}
      </ul>
      <Link href="/monitors" className={m.editButton}>All monitors</Link>
    </aside>
  );
}
