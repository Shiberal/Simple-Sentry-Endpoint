import { Fragment, useCallback, useEffect, useState } from 'react';
import { ago, fmtDuration, pct, rateTone, span } from './helpers';
import { ChartPanel } from './charts';
import m from '@/styles/Monitors.module.css';

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


/** Last 30 runs as a strip of bars: colour = outcome, height = duration relative to the slowest. */
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
