const MINUTE_MS = 60 * 1000;
const DEFAULT_FALLBACK_INTERVAL_MS = 5 * MINUTE_MS;
const MAX_LOOKBACK_MINUTES = 7 * 24 * 60;

function parseCronNumber(value, min, max, normalize) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const normalized = normalize ? normalize(parsed) : parsed;
  if (normalized < min || normalized > max) return null;
  return normalized;
}

function parseCronField(field, min, max, normalize) {
  const trimmed = String(field || '').trim();
  if (!trimmed || trimmed === '*') return { ok: true, values: null };

  const values = new Set();

  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim();
    if (!part) return { ok: false, values: null };

    const pieces = part.split('/');
    if (pieces.length > 2) return { ok: false, values: null };

    const rangePart = pieces[0];
    const step = pieces[1] == null ? 1 : parseInt(pieces[1], 10);
    if (!Number.isFinite(step) || step <= 0) return { ok: false, values: null };

    let start = min;
    let end = max;

    if (rangePart !== '*') {
      if (rangePart.includes('-')) {
        const [startRaw, endRaw] = rangePart.split('-');
        start = parseCronNumber(startRaw, min, max, normalize);
        end = parseCronNumber(endRaw, min, max, normalize);
        if (start == null || end == null || start > end) {
          return { ok: false, values: null };
        }
      } else {
        start = parseCronNumber(rangePart, min, max, normalize);
        if (start == null) return { ok: false, values: null };
        end = start;
      }
    }

    for (let value = start; value <= end; value += step) {
      values.add(value);
    }
  }

  return { ok: true, values };
}

export function parseCronSchedule(schedule) {
  const fields = String(schedule || '').trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const [minuteRaw, hourRaw, dayOfMonthRaw, monthRaw, dayOfWeekRaw] = fields;
  const minute = parseCronField(minuteRaw, 0, 59);
  const hour = parseCronField(hourRaw, 0, 23);
  const dayOfMonth = parseCronField(dayOfMonthRaw, 1, 31);
  const month = parseCronField(monthRaw, 1, 12);
  const dayOfWeek = parseCronField(dayOfWeekRaw, 0, 6, (value) =>
    value === 7 ? 0 : value
  );

  if (
    !minute.ok ||
    !hour.ok ||
    !dayOfMonth.ok ||
    !month.ok ||
    !dayOfWeek.ok
  ) {
    return null;
  }

  return {
    minute: minute.values,
    hour: hour.values,
    dayOfMonth: dayOfMonth.values,
    month: month.values,
    dayOfWeek: dayOfWeek.values
  };
}

function matchesField(values, value) {
  return values == null || values.has(value);
}

export function cronScheduleMatchesDate(parsedSchedule, date) {
  const dayOfMonthMatches = matchesField(
    parsedSchedule.dayOfMonth,
    date.getDate()
  );
  const dayOfWeekMatches = matchesField(parsedSchedule.dayOfWeek, date.getDay());

  const dayMatches =
    parsedSchedule.dayOfMonth == null && parsedSchedule.dayOfWeek == null
      ? true
      : parsedSchedule.dayOfMonth == null
        ? dayOfWeekMatches
        : parsedSchedule.dayOfWeek == null
          ? dayOfMonthMatches
          : dayOfMonthMatches || dayOfWeekMatches;

  return (
    matchesField(parsedSchedule.minute, date.getMinutes()) &&
    matchesField(parsedSchedule.hour, date.getHours()) &&
    matchesField(parsedSchedule.month, date.getMonth() + 1) &&
    dayMatches
  );
}

function startOfMinute(date) {
  return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS);
}

function firstMinuteAfter(date) {
  return new Date(startOfMinute(date).getTime() + MINUTE_MS);
}

function scheduleOccurredSince(parsedSchedule, lastCheckInAt, now) {
  const nowMinute = startOfMinute(now);
  let cursor = firstMinuteAfter(lastCheckInAt);
  const earliest = new Date(nowMinute.getTime() - MAX_LOOKBACK_MINUTES * MINUTE_MS);

  if (cursor < earliest) cursor = earliest;

  while (cursor <= nowMinute) {
    if (cronScheduleMatchesDate(parsedSchedule, cursor)) return true;
    cursor = new Date(cursor.getTime() + MINUTE_MS);
  }

  return false;
}

export function isMonitorDueForHttpPing(
  monitor,
  now = new Date(),
  fallbackIntervalMs = DEFAULT_FALLBACK_INTERVAL_MS
) {
  const lastCheckInAt = monitor.lastCheckInAt
    ? new Date(monitor.lastCheckInAt)
    : null;
  const hasValidLastCheckIn =
    lastCheckInAt instanceof Date && !Number.isNaN(lastCheckInAt.getTime());
  const schedule = String(monitor.schedule || '').trim();

  if (!schedule) {
    if (!hasValidLastCheckIn) return true;
    return now.getTime() - lastCheckInAt.getTime() >= fallbackIntervalMs;
  }

  const parsedSchedule = parseCronSchedule(schedule);
  if (!parsedSchedule) {
    if (!hasValidLastCheckIn) return true;
    return now.getTime() - lastCheckInAt.getTime() >= fallbackIntervalMs;
  }

  if (!hasValidLastCheckIn) {
    return cronScheduleMatchesDate(parsedSchedule, startOfMinute(now));
  }

  return scheduleOccurredSince(parsedSchedule, lastCheckInAt, now);
}

export { DEFAULT_FALLBACK_INTERVAL_MS as DEFAULT_MONITOR_PING_INTERVAL_MS };
