/**
 * EDT tool catalog — same app, same origin. Hub is `/`; tools are routes below.
 */

export const TOOLS = [
  {
    id: 'sentry-performance',
    name: 'Sentry + Performance',
    shortName: 'Sentry',
    icon: 'activity',
    packageDir: 'tools/SimpleSentryEndpoint',
    npmName: '@edt/simple-sentry-endpoint',
    summary: 'Ingest SDK events, triage issues, and inspect performance transactions.',
    href: '/dashboard',
    actions: [
      { id: 'issues', label: 'Issues', href: '/dashboard' },
      { id: 'performance', label: 'Performance', href: '/performance' },
      { id: 'projects', label: 'Projects', href: '/projects' },
    ],
  },
  {
    id: 'monitor',
    name: 'Monitor',
    shortName: 'Monitor',
    icon: 'clock',
    packageDir: 'tools/Monitor',
    npmName: '@edt/monitor',
    summary: 'Cron and HTTP uptime monitors, check-ins, and alerting.',
    href: '/monitors',
    actions: [
      { id: 'list', label: 'Monitors', href: '/monitors' },
    ],
  },
];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id) || null;
}
