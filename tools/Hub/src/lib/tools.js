/**
 * EDT tool catalog. Each tool can run as its own deployable; Hub opens them
 * via base URL (iframe workspace or new tab).
 *
 * Hub is the main page (:3000). Tools default to the Sentry runtime on :3001.
 * Override with env:
 *   NEXT_PUBLIC_TOOL_SENTRY_URL   (default http://localhost:3001)
 *   NEXT_PUBLIC_TOOL_MONITOR_URL  (default http://localhost:3001/monitors)
 */

function envUrl(key, fallback) {
  if (typeof process === 'undefined') return fallback;
  const v = process.env[key];
  return v && String(v).trim() ? String(v).trim().replace(/\/$/, '') : fallback;
}

export const TOOLS = [
  {
    id: 'sentry-performance',
    name: 'Sentry + Performance',
    shortName: 'Sentry',
    icon: 'activity',
    packageDir: 'tools/SimpleSentryEndpoint',
    npmName: '@edt/simple-sentry-endpoint',
    summary: 'Ingest SDK events, triage issues, and inspect performance transactions.',
    detail:
      'Error sink compatible with Sentry SDKs: projects, issues, events, releases, and the performance views. Admin and auth live here too while Monitor stays a separate tool entry.',
    actions: [
      { id: 'issues', label: 'Issues', path: '/dashboard' },
      { id: 'performance', label: 'Performance', path: '/performance' },
      { id: 'projects', label: 'Projects', path: '/projects' },
    ],
    getBaseUrl: () => envUrl('NEXT_PUBLIC_TOOL_SENTRY_URL', 'http://localhost:3001'),
  },
  {
    id: 'monitor',
    name: 'Monitor',
    shortName: 'Monitor',
    icon: 'clock',
    packageDir: 'tools/Monitor',
    npmName: '@edt/monitor',
    summary: 'Cron and HTTP uptime monitors, check-ins, and alerting.',
    detail:
      'Dedicated monitor surface: schedules, ping URLs, incidents, and worker health. Backed by the same SimpleSentryEndpoint runtime for now; Hub treats it as its own tool.',
    actions: [
      { id: 'list', label: 'Monitors', path: '' },
    ],
    getBaseUrl: () => envUrl('NEXT_PUBLIC_TOOL_MONITOR_URL', 'http://localhost:3001/monitors'),
  },
];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id) || null;
}

export function toolOpenUrl(tool, path = '') {
  const base = tool.getBaseUrl();
  if (!path) return base;
  if (path.startsWith('http')) return path;
  // Monitor base may already include /monitors
  if (tool.id === 'monitor' && (!path || path === '/')) return base;
  try {
    const u = new URL(base);
    if (path.startsWith('/')) {
      u.pathname = path;
      u.search = '';
      u.hash = '';
      return u.toString().replace(/\/$/, '') || u.origin;
    }
    return `${base.replace(/\/$/, '')}/${path}`;
  } catch {
    return `${base}${path}`;
  }
}
