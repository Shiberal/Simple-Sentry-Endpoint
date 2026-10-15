/**
 * EDT tool catalog — used for Hub status cards and docs.
 * Switching tools is the left EdtToolRail, not this list.
 */

export const TOOLS = [
  {
    id: 'sentry-performance',
    tabId: 'sentry',
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
    tabId: 'monitor',
    name: 'Monitor',
    shortName: 'Monitor',
    icon: 'clock',
    packageDir: 'tools/Monitor',
    npmName: '@edt/monitor',
    summary: 'Cron and HTTP uptime monitors, check-ins, and alerting.',
    href: '/monitors',
    actions: [{ id: 'list', label: 'Monitors', href: '/monitors' }],
  },
];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id) || null;
}
