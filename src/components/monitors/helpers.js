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


async function send(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Request failed');
  return j;
}

/** Route id for a monitor's scope: its project id, or "standalone" when it has none. */
export const scopeOf = (mon) => mon.projectId ?? 'standalone';
export const projectLabel = (mon) => mon.project?.name || 'Standalone';

/** Actions on one monitor; each throws an Error with a readable message. */
export const monitorApi = {
  run: (mon) => send(`/api/projects/${scopeOf(mon)}/monitors/ping`, { method: 'POST', body: JSON.stringify({ monitorId: mon.id }) }),
  setPaused: (mon, paused) => send(`/api/projects/${scopeOf(mon)}/monitors`, { method: 'PATCH', body: JSON.stringify({ monitorId: mon.id, status: paused ? 'paused' : 'active' }) }),
  remove: (mon) => send(`/api/projects/${scopeOf(mon)}/monitors?monitorId=${mon.id}`, { method: 'DELETE' })
};
