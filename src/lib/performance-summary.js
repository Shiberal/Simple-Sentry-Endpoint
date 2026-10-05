/** Client-side roll-ups of TRANSACTION events for the performance overview. Durations are in ms. */

const OK_STATUSES = new Set(['ok', 'cancelled', undefined, null, '']);

export function transactionDurationMs(t) {
  const d = t.data || {};
  if (typeof d.timestamp === 'number' && typeof d.start_timestamp === 'number') return Math.max(0, (d.timestamp - d.start_timestamp) * 1000);
  return 0;
}

export const transactionFailed = (t) => !OK_STATUSES.has(t.data?.contexts?.trace?.status ?? t.data?.status);

/** Nearest-rank percentile of an ascending-sorted array. */
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const sortAsc = (a) => [...a].sort((x, y) => x - y);
const sum = (a) => a.reduce((x, y) => x + y, 0);

export const LATENCY_BUCKETS = [50, 100, 250, 500, 1000, 2500, Infinity];

export function summarizeTransactions(transactions) {
  const rows = transactions
    .map((t) => ({ id: t.id, name: t.data?.transaction || 'Unnamed', ms: transactionDurationMs(t), failed: transactionFailed(t), at: new Date(t.createdAt).getTime() }))
    .filter((r) => r.ms > 0);
  if (!rows.length) return null;

  const all = sortAsc(rows.map((r) => r.ms));
  const totalMs = sum(all);
  const oldest = Math.min(...rows.map((r) => r.at));
  const newest = Math.max(...rows.map((r) => r.at));
  const spanMin = Math.max(1, (newest - oldest) / 60000);

  // p95 of the older half vs the newer half of the window, to show direction
  const mid = (oldest + newest) / 2;
  const early = sortAsc(rows.filter((r) => r.at < mid).map((r) => r.ms));
  const late = sortAsc(rows.filter((r) => r.at >= mid).map((r) => r.ms));
  const p95Trend = early.length >= 5 && late.length >= 5 && percentile(early, 95) > 0
    ? (percentile(late, 95) - percentile(early, 95)) / percentile(early, 95)
    : null;

  const byName = new Map();
  rows.forEach((r) => {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  });
  const endpoints = [...byName].map(([name, list]) => {
    const d = sortAsc(list.map((r) => r.ms));
    const total = sum(d);
    const errors = list.filter((r) => r.failed).length;
    return {
      name,
      count: list.length,
      avg: total / list.length,
      p50: percentile(d, 50),
      p95: percentile(d, 95),
      max: d[d.length - 1],
      errors,
      errorRate: errors / list.length,
      totalMs: total,
      share: total / totalMs,
      lastSeen: Math.max(...list.map((r) => r.at))
    };
  });

  const histogram = LATENCY_BUCKETS.map((upTo, i) => ({
    upTo,
    count: all.filter((ms) => ms < upTo && ms >= (i ? LATENCY_BUCKETS[i - 1] : 0)).length
  }));

  const errors = rows.filter((r) => r.failed).length;
  return {
    total: rows.length,
    avg: totalMs / rows.length,
    p50: percentile(all, 50),
    p95: percentile(all, 95),
    p99: percentile(all, 99),
    throughputPerMin: rows.length / spanMin,
    errors,
    errorRate: errors / rows.length,
    p95Trend,
    endpoints,
    histogram,
    slowest: [...rows].sort((a, b) => b.ms - a.ms).slice(0, 10)
  };
}
