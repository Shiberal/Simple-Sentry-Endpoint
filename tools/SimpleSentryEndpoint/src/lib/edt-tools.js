/**
 * EDT tool catalog. Hub is `/hub`; Sentry issues live at `/hub/sentry`.
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
    href: '/hub/sentry',
    actions: [
      { id: 'issues', label: 'Issues', href: '/hub/sentry' },
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

export const HUB_TABS = [
  { id: 'overview', label: 'Overview', href: '/hub' },
  { id: 'sentry', label: 'Sentry', href: '/hub/sentry' },
  { id: 'monitor', label: 'Monitor', href: '/monitors' },
];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id) || null;
}
