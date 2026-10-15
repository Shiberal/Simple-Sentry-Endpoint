import { DEFAULT_MONITOR_PING_INTERVAL_MS, parseCronSchedule, cronScheduleMatchesDate } from './monitor-schedule.js';

const MINUTE_MS = 60 * 1000;
const RUNNING_MAX_MS = 60 * MINUTE_MS;
const LOOKBACK_MINUTES = 8 * 24 * 60;
const LOOKAHEAD_MINUTES = 45 * 24 * 60;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n) => String(n).padStart(2, '0');
const isNum = (s) => /^\d+$/.test(s);
const minuteFloor = (date) => new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS);

/** Latest scheduled run at or before `before`, or null within the lookback window. */
export function lastScheduledRun(parsed, before) {
  let cursor = minuteFloor(before);
  for (let i = 0; i < LOOKBACK_MINUTES; i += 1) {
    if (cronScheduleMatchesDate(parsed, cursor)) return cursor;
    cursor = new Date(cursor.getTime() - MINUTE_MS);
  }
  return null;
}

/** First scheduled run strictly after `after`, or null within the lookahead window. */
export function nextScheduledRun(parsed, after) {
  let cursor = new Date(minuteFloor(after).getTime() + MINUTE_MS);
  for (let i = 0; i < LOOKAHEAD_MINUTES; i += 1) {
    if (cronScheduleMatchesDate(parsed, cursor)) return cursor;
    cursor = new Date(cursor.getTime() + MINUTE_MS);
  }
  return null;
}

/** Human wording for the common cron shapes; anything else is returned as written. */
export function describeSchedule(schedule) {
  const raw = String(schedule || '').trim();
  if (!raw) return null;
  const f = raw.split(/\s+/);
  if (f.length !== 5 || !parseCronSchedule(raw)) return raw;
  const [m, h, dom, mon, dow] = f;
  const time = isNum(m) && isNum(h) ? `${pad(h)}:${pad(m)}` : null;

  if (dom === '*' && mon === '*' && dow === '*') {
    if (m === '*' && h === '*') return 'Every minute';
    const everyMin = /^\*\/(\d+)$/.exec(m);
    if (everyMin && h === '*') return `Every ${everyMin[1]} minutes`;
    if (isNum(m) && h === '*') return m === '0' ? 'Every hour' : `Hourly at :${pad(m)}`;
    const everyHour = /^\*\/(\d+)$/.exec(h);
    if (isNum(m) && everyHour) return `Every ${everyHour[1]} hours at :${pad(m)}`;
    if (time) return `Daily at ${time}`;
  }
  if (time && dom === '*' && mon === '*') {
    if (dow === '1-5') return `Weekdays at ${time}`;
    if (isNum(dow)) return `${DAYS[Number(dow) % 7]}s at ${time}`;
  }
  return raw;
}

/**
 * Work out how a monitor is doing.
 *
 * health: ok | failing | missed | running | paused | pending | unknown
 *  - failing: the last finished run reported an error
 *  - missed:  a scheduled run came and went (plus grace) with no check-in
 *  - running: an in-progress check-in is open
 *  - pending: nothing expected yet (new monitor, first run not due)
 *  - unknown: no schedule and no ping URLs, so nothing can be expected
 *
 * @param {{ monitor, latest, lastFinished, now?, fallbackIntervalMs? }} input
 *   latest = newest check-in of any status; lastFinished = newest that is not in_progress
 */
export function computeMonitorHealth({
  monitor,
  latest = null,
  lastFinished = null,
  now = new Date(),
  fallbackIntervalMs = DEFAULT_MONITOR_PING_INTERVAL_MS
}) {
  const paused = monitor.status === 'paused';
  const parsed = monitor.schedule ? parseCronSchedule(monitor.schedule) : null;
  const hasPings = Array.isArray(monitor.pingUrls) && monitor.pingUrls.length > 0;

  let lastExpectedAt = null;
  let nextRunAt = null;
  let intervalMs = null;

  if (parsed) {
    lastExpectedAt = lastScheduledRun(parsed, now);
    nextRunAt = nextScheduledRun(parsed, now);
    if (lastExpectedAt && nextRunAt) intervalMs = nextRunAt - lastExpectedAt;
  } else if (hasPings) {
    intervalMs = fallbackIntervalMs;
    const base = lastFinished?.createdAt || monitor.lastCheckInAt;
    if (base) {
      nextRunAt = new Date(new Date(base).getTime() + intervalMs);
      lastExpectedAt = nextRunAt <= now ? nextRunAt : null;
    }
  }

  const graceMs = intervalMs
    ? Math.max(2 * MINUTE_MS, Math.min(30 * MINUTE_MS, Math.round(intervalMs * 0.1)))
    : 2 * MINUTE_MS;

  const base = { nextRunAt, lastExpectedAt, intervalMs, graceMs };
  const finish = (health, reason) => ({ health, reason, ...base });

  if (paused) return finish('paused', 'Paused: no runs are expected');

  if (latest?.status === 'in_progress') {
    const startedAt = new Date(latest.createdAt);
    if (now - startedAt < RUNNING_MAX_MS) return finish('running', 'A run is in progress');
  }

  const overdue =
    lastExpectedAt &&
    now - lastExpectedAt > graceMs &&
    new Date(lastExpectedAt) > new Date(monitor.createdAt || 0);

  if (!lastFinished) {
    if (overdue) return finish('missed', 'No check-in since the monitor was created');
    if (parsed || hasPings) return finish('pending', 'Waiting for the first run');
    return finish('unknown', 'No schedule or ping URLs, so missed runs cannot be detected');
  }

  if (lastFinished.status === 'error') return finish('failing', 'The last run reported an error');

  if (overdue && new Date(lastFinished.createdAt) < lastExpectedAt) {
    return finish('missed', 'A scheduled run has not checked in');
  }
  return finish('ok', 'Last run succeeded');
}

const SEVERITY = { failing: 0, missed: 1, running: 2, pending: 3, unknown: 4, ok: 5, paused: 6 };
export const healthSeverity = (health) => SEVERITY[health] ?? 9;
