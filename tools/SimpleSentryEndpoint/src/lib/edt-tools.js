/**
 * EDT tool catalog. Hub is `/hub`; tools open under Hub tabs, then into their workspaces.
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
    actions: [
      { id: 'list', label: 'Monitors', href: '/monitors' },
    ],
  },
];

/** Hub content tabs — stay on /hub and switch which tools you see. */
export const HUB_TABS = [
  { id: 'all', label: 'All tools', href: '/hub' },
  { id: 'sentry', label: 'Sentry', href: '/hub?tab=sentry' },
  { id: 'monitor', label: 'Monitor', href: '/hub?tab=monitor' },
];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id) || null;
}

export function toolsForHubTab(tabId) {
  if (!tabId || tabId === 'all' || tabId === 'overview') return TOOLS;
  return TOOLS.filter((t) => t.tabId === tabId);
}

export function normalizeHubTab(tab) {
  if (tab === 'sentry' || tab === 'monitor') return tab;
  return 'all';
}
