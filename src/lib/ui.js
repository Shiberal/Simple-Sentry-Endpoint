// Small presentation helpers shared by the dashboard

const STATUS_LABELS = {
  UNRESOLVED: 'Unresolved',
  RESOLVED: 'Resolved',
  IGNORED: 'Ignored',
  IN_PROGRESS: 'In progress',
  ACTIVE: 'Active',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Unknown';
}

// Maps an event level to a semantic color token pair
export function levelColors(level) {
  switch (level) {
    case 'fatal':
    case 'error':
      return { fg: 'var(--error)', bg: 'var(--error-bg)' };
    case 'warning':
      return { fg: 'var(--warning)', bg: 'var(--warning-bg)' };
    case 'info':
      return { fg: 'var(--info)', bg: 'var(--info-bg)' };
    case 'debug':
      return { fg: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' };
    default:
      return { fg: 'var(--success)', bg: 'var(--success-bg)' };
  }
}

export function relativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export const TIME_RANGES = {
  all: { label: 'Any time', ms: null },
  '1h': { label: 'Last hour', ms: 3600000 },
  '24h': { label: 'Last 24 hours', ms: 86400000 },
  '7d': { label: 'Last 7 days', ms: 7 * 86400000 },
  '30d': { label: 'Last 30 days', ms: 30 * 86400000 },
};

export const SORT_OPTIONS = {
  lastSeen: 'Last seen',
  firstSeen: 'First seen',
  count: 'Most events',
};

function csvCell(value) {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Trigger a browser download of the given issues as CSV or JSON
export function downloadIssues(items, format = 'csv') {
  const rows = items.map((i) => ({
    id: i.id,
    title: i.title,
    level: i.level,
    status: i.status,
    project: i.project?.name || '',
    events: i.count ?? 1,
    firstSeen: i.firstSeen || '',
    lastSeen: i.lastSeen || '',
    culprit: i.culprit || '',
    githubIssueUrl: i.githubIssueUrl || '',
  }));

  let body;
  let type;
  if (format === 'json') {
    body = JSON.stringify(rows, null, 2);
    type = 'application/json';
  } else {
    const headers = Object.keys(rows[0] || { id: '' });
    body = [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
    type = 'text/csv';
  }

  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `issues-${new Date().toISOString().slice(0, 10)}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
