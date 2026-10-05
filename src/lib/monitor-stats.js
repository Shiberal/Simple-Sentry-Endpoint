const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const STATS_WINDOWS = [
  ['24h', DAY_MS],
  ['7d', 7 * DAY_MS],
  ['30d', 30 * DAY_MS]
];
export const STATS_MAX_DAYS = 30;

const round1 = (n) => Math.round(n * 10) / 10;

/** Nearest-rank percentile of an ascending-sorted array. */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function durationStats(values) {
  if (!values.length) return { avgMs: null, p95Ms: null, maxMs: null };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return { avgMs: Math.round(sum / sorted.length), p95Ms: Math.round(percentile(sorted, 95)), maxMs: Math.round(sorted[sorted.length - 1]) };
}

/**
 * Turn a monitor's check-ins into the numbers worth looking at.
 * Only finished runs (ok / error) count; an in_progress check-in is a run that has not reported yet.
 * Missed runs leave no check-in, so rates describe the runs that happened, not the ones that never did.
 *
 * Incident = an unbroken streak of failed runs, ended by the next successful run.
 *
 * @param {{ checkIns: Array<{status, durationMs, createdAt}>, now?: Date }} input  any order
 */
export function computeMonitorStats({ checkIns, now = new Date() }) {
  const finished = checkIns
    .filter((c) => c.status === 'ok' || c.status === 'error')
    .map((c) => ({ status: c.status, durationMs: c.durationMs, at: new Date(c.createdAt) }))
    .sort((a, b) => a.at - b.at);
  const nowMs = now.getTime();

  const windows = {};
  for (const [key, ms] of STATS_WINDOWS) {
    const inWin = finished.filter((c) => nowMs - c.at.getTime() <= ms);
    const ok = inWin.filter((c) => c.status === 'ok').length;
    const error = inWin.length - ok;
    windows[key] = {
      runs: inWin.length,
      ok,
      error,
      uptime: inWin.length ? round1((ok / inWin.length) * 100) : null,
      ...durationStats(inWin.filter((c) => c.status === 'ok' && c.durationMs != null).map((c) => c.durationMs))
    };
  }

  const incidents = [];
  let open = null;
  for (const c of finished) {
    if (c.status === 'error') {
      if (!open) open = { startedAt: c.at, failedRuns: 0 };
      open.failedRuns += 1;
    } else if (open) {
      incidents.push({ ...open, endedAt: c.at });
      open = null;
    }
  }
  if (open) incidents.push({ ...open, endedAt: null });
  const shaped = incidents.map((i) => ({
    startedAt: i.startedAt,
    endedAt: i.endedAt,
    ongoing: !i.endedAt,
    failedRuns: i.failedRuns,
    durationMs: (i.endedAt ? i.endedAt.getTime() : nowMs) - i.startedAt.getTime()
  }));
  const resolved = shaped.filter((i) => !i.ongoing);

  let streak = null;
  if (finished.length) {
    const last = finished[finished.length - 1];
    let count = 0;
    let since = last.at;
    for (let i = finished.length - 1; i >= 0 && finished[i].status === last.status; i -= 1) {
      count += 1;
      since = finished[i].at;
    }
    streak = { status: last.status, count, since };
  }

  const lastOf = (status) => [...finished].reverse().find((c) => c.status === status)?.at || null;

  const days = [];
  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (STATS_MAX_DAYS - 1) * DAY_MS);
  for (let i = 0; i < STATS_MAX_DAYS; i += 1) {
    days.push({ date: new Date(startDay.getTime() + i * DAY_MS).toISOString().slice(0, 10), ok: 0, error: 0, sumMs: 0, timed: 0 });
  }
  for (const c of finished) {
    const idx = Math.floor((c.at.getTime() - startDay.getTime()) / DAY_MS);
    if (idx < 0 || idx >= days.length) continue;
    const d = days[idx];
    d[c.status] += 1;
    if (c.status === 'ok' && c.durationMs != null) { d.sumMs += c.durationMs; d.timed += 1; }
  }

  return {
    windows,
    streak,
    lastSuccessAt: lastOf('ok'),
    lastFailureAt: lastOf('error'),
    incidents: {
      count30d: shaped.length,
      ongoing: shaped.some((i) => i.ongoing),
      currentDowntimeMs: shaped.find((i) => i.ongoing)?.durationMs ?? null,
      longestMs: shaped.length ? Math.max(...shaped.map((i) => i.durationMs)) : null,
      mttrMs: resolved.length ? Math.round(resolved.reduce((a, i) => a + i.durationMs, 0) / resolved.length) : null,
      last: shaped.length ? shaped[shaped.length - 1] : null,
      recent: shaped.slice(-10).reverse()
    },
    daily: days.map((d) => ({
      date: d.date,
      ok: d.ok,
      error: d.error,
      uptime: d.ok + d.error ? round1((d.ok / (d.ok + d.error)) * 100) : null,
      avgMs: d.timed ? Math.round(d.sumMs / d.timed) : null
    }))
  };
}

/** Roll per-monitor stats up into one project-level summary. */
export function summarizeProjectStats(statsList) {
  const out = { windows: {}, incidentsOpen: 0, incidents30d: 0, worst: null };
  for (const [key] of STATS_WINDOWS) {
    const runs = statsList.reduce((n, s) => n + s.windows[key].runs, 0);
    const ok = statsList.reduce((n, s) => n + s.windows[key].ok, 0);
    const avgs = statsList.filter((s) => s.windows[key].avgMs != null);
    out.windows[key] = {
      runs,
      ok,
      error: runs - ok,
      uptime: runs ? round1((ok / runs) * 100) : null,
      avgMs: avgs.length ? Math.round(avgs.reduce((n, s) => n + s.windows[key].avgMs, 0) / avgs.length) : null,
      p95Ms: avgs.length ? Math.max(...avgs.map((s) => s.windows[key].p95Ms)) : null
    };
  }
  statsList.forEach((s) => {
    if (s.incidents.ongoing) out.incidentsOpen += 1;
    out.incidents30d += s.incidents.count30d;
  });
  const dailyByDate = new Map();
  statsList.forEach((s) => s.daily.forEach((d) => {
    const cur = dailyByDate.get(d.date) || { date: d.date, ok: 0, error: 0 };
    cur.ok += d.ok;
    cur.error += d.error;
    dailyByDate.set(d.date, cur);
  }));
  out.daily = [...dailyByDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, uptime: d.ok + d.error ? round1((d.ok / (d.ok + d.error)) * 100) : null }));
  return out;
}
