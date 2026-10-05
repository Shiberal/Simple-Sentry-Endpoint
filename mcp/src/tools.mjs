import { z } from 'zod';

const projectId = z.number().int().describe('Project id (see list_projects)');
const days = (d) => z.number().int().min(1).max(365).default(d).describe('Look-back window in days');

// Cap very large payloads (events carry full stack traces / breadcrumbs).
const MAX_CHARS = 60000;
const text = (value) => {
  let s = JSON.stringify(value, null, 2);
  if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS) + `\n… truncated (${s.length - MAX_CHARS} more characters)`;
  return { content: [{ type: 'text', text: s }] };
};

/**
 * Tool definitions. `write: true` tools are only registered when writes are
 * enabled; `cron: true` tools need MONITOR_CRON_SECRET.
 */
export function buildTools(client) {
  return [
    // ---- projects ----
    {
      name: 'list_projects',
      description: 'List projects visible to the logged-in user, with event and open-issue counts.',
      schema: {},
      run: async () => client.get('/api/projects')
    },
    {
      name: 'get_project',
      description: 'Get one project, including its key (used to build the DSN).',
      schema: { projectId },
      run: async ({ projectId }) => client.get(`/api/projects/${projectId}`)
    },
    {
      name: 'projects_summary',
      description: 'Performance summary across all projects (transaction volume, latency percentiles) for a time window.',
      schema: { window: z.enum(['24h', '7d', '30d']).default('24h') },
      run: async ({ window }) => client.get('/api/analytics/projects-summary', { window })
    },
    {
      name: 'list_releases',
      description: 'List releases seen for a project.',
      schema: { projectId },
      run: async ({ projectId }) => client.get(`/api/projects/${projectId}/releases`)
    },

    // ---- issues ----
    {
      name: 'list_issues',
      description: 'List issues with filters and paging. status: active|all|unresolved|resolved|ignored|in_progress.',
      schema: {
        projectId: projectId.optional(),
        status: z.string().optional(),
        level: z.string().optional().describe('error, warning, info, ...'),
        search: z.string().optional().describe('Matches title or culprit'),
        dateFrom: z.string().optional().describe('ISO date, filters on lastSeen'),
        dateTo: z.string().optional(),
        sortBy: z.enum(['lastSeen', 'firstSeen', 'count', 'createdAt', 'title']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(200).optional()
      },
      run: async (args) => client.get('/api/issues', args)
    },
    {
      name: 'get_issue',
      description: 'Get one issue with its latest events and comments.',
      schema: { issueId: z.number().int() },
      run: async ({ issueId }) => client.get(`/api/issues/${issueId}`)
    },
    {
      name: 'list_issue_comments',
      description: 'List comments on an issue.',
      schema: { issueId: z.number().int() },
      run: async ({ issueId }) => client.get(`/api/issues/${issueId}/comments`)
    },
    {
      name: 'find_duplicate_issues',
      description: 'Find groups of issues in a project that look like duplicates (candidates for merge_issues).',
      schema: { projectId },
      run: async ({ projectId }) => client.get('/api/issues/duplicates', { projectId })
    },
    {
      name: 'top_issues',
      description: 'Most frequent issues in a time window.',
      schema: { projectId: projectId.optional(), limit: z.number().int().min(1).max(100).default(10), days: days(30) },
      run: async (args) => client.get('/api/analytics/top-issues', args)
    },

    // ---- events ----
    {
      name: 'list_events',
      description: 'List the most recent events (newest first).',
      schema: { projectId: projectId.optional(), limit: z.number().int().min(1).max(200).default(50) },
      run: async (args) => client.get('/api/events', args)
    },
    {
      name: 'get_event',
      description: 'Get a single event, including the full payload (stack trace, breadcrumbs, tags).',
      schema: { eventId: z.number().int() },
      run: async ({ eventId }) => client.get(`/api/events/${eventId}`)
    },

    // ---- analytics / performance ----
    {
      name: 'error_trends',
      description: 'Error volume over time.',
      schema: { projectId: projectId.optional(), days: days(7) },
      run: async (args) => client.get('/api/analytics/trends', args)
    },
    {
      name: 'error_breakdown',
      description: 'Breakdown of events by level, type and similar dimensions.',
      schema: { projectId: projectId.optional(), days: days(30) },
      run: async (args) => client.get('/api/analytics/breakdown', args)
    },
    {
      name: 'performance_stats',
      description: 'Transaction performance stats (counts, latency percentiles, slowest pages) for a project.',
      schema: {
        projectId,
        pageUrl: z.string().optional().describe('Restrict to one page / transaction name'),
        startDate: z.string().optional().describe('ISO date'),
        endDate: z.string().optional()
      },
      run: async (args) => client.get('/api/analytics/performance', args)
    },
    {
      name: 'performance_timeseries',
      description: 'Transaction performance over time, bucketed by interval.',
      schema: {
        projectId,
        interval: z.enum(['hour', 'day']).default('day'),
        pageUrl: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional()
      },
      run: async (args) => client.get('/api/analytics/performance/timeseries', args)
    },

    // ---- monitors ----
    {
      name: 'list_monitors',
      description: 'List cron monitors for a project with health, reason for failure, recent check-ins and stats per monitor (uptime and latency for 24h/7d/30d, streak, incidents, daily series), plus a project summary.',
      schema: { projectId },
      run: async ({ projectId }) => client.get(`/api/projects/${projectId}/monitors`)
    },
    {
      name: 'monitor_stats',
      description: 'Monitor statistics only (no check-in rows): uptime %, run counts, avg/p95/max run time for 24h/7d/30d, current streak, incidents (count, avg recovery time, longest, recent list) and a 30-day daily series. Pass monitorId for one monitor, or omit for every monitor plus a project rollup.',
      schema: {
        projectId,
        monitorId: z.number().int().optional(),
        range: z.enum(['24h', '7d', '30d', '90d']).optional().describe('Series range: hourly buckets for 24h, 6-hourly for 7d, daily for 30d/90d (default 30d)')
      },
      run: async ({ projectId, monitorId, range }) => {
        const q = new URLSearchParams();
        if (monitorId != null) q.set('monitorId', monitorId);
        if (range) q.set('range', range);
        return client.get(`/api/projects/${projectId}/monitors/stats${q.size ? `?${q}` : ''}`);
      }
    },
    {
      name: 'monitor_checkins',
      description: 'Check-in history of one monitor, newest first: status, run time, source and per-URL results. Filter by status, look back N days, page with before=<last id>.',
      schema: {
        projectId,
        monitorId: z.number().int(),
        status: z.enum(['ok', 'error', 'in_progress']).optional(),
        days: z.number().int().min(1).max(90).optional(),
        before: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).optional()
      },
      run: async ({ projectId, ...rest }) => {
        const q = new URLSearchParams();
        Object.entries(rest).forEach(([k, v]) => v != null && q.set(k, v));
        return client.get(`/api/projects/${projectId}/monitors/checkins?${q}`);
      }
    },

    // ---- writes (opt-in) ----
    {
      name: 'update_issue',
      description: 'Change an issue status (UNRESOLVED, RESOLVED, IGNORED, IN_PROGRESS) and/or assignee.',
      write: true,
      schema: {
        issueId: z.number().int(),
        status: z.enum(['UNRESOLVED', 'RESOLVED', 'IGNORED', 'IN_PROGRESS']).optional(),
        assignedToId: z.number().int().nullable().optional()
      },
      run: async ({ issueId, ...body }) => client.patch(`/api/issues/${issueId}`, body)
    },
    {
      name: 'add_issue_comment',
      description: 'Add a comment to an issue (posted as the logged-in user).',
      write: true,
      schema: { issueId: z.number().int(), text: z.string().min(1) },
      run: async ({ issueId, text }) => client.post(`/api/issues/${issueId}/comments`, { text })
    },
    {
      name: 'merge_issues',
      description: 'Merge source issues into a target issue. Irreversible.',
      write: true,
      schema: { projectId, targetIssueId: z.number().int(), sourceIssueIds: z.array(z.number().int()).min(1) },
      run: async (args) => client.post('/api/issues/merge', args)
    },
    {
      name: 'create_monitor',
      description: 'Create a cron monitor. schedule is a 5-field cron expression; pingUrls are polled by the server.',
      write: true,
      schema: {
        projectId,
        slug: z.string().describe('1-128 chars: letters, numbers, hyphen, underscore'),
        name: z.string().optional(),
        schedule: z.string().optional(),
        environment: z.string().optional(),
        status: z.enum(['active', 'paused']).optional(),
        pingUrls: z.array(z.string()).optional()
      },
      run: async ({ projectId, ...body }) => client.post(`/api/projects/${projectId}/monitors`, body)
    },
    {
      name: 'update_monitor',
      description: 'Update a monitor; use status "paused" / "active" to pause or resume it.',
      write: true,
      schema: {
        projectId,
        monitorId: z.number().int(),
        name: z.string().optional(),
        schedule: z.string().optional(),
        environment: z.string().optional(),
        status: z.enum(['active', 'paused']).optional(),
        pingUrls: z.array(z.string()).optional()
      },
      run: async ({ projectId, ...body }) => client.patch(`/api/projects/${projectId}/monitors`, body)
    },
    {
      name: 'ping_monitors',
      description: 'Run the HTTP pings now for one monitor (monitorId) or all monitors of a project. Paused monitors are skipped.',
      write: true,
      schema: { projectId, monitorId: z.number().int().optional() },
      run: async ({ projectId, monitorId }) =>
        client.post(`/api/projects/${projectId}/monitors/ping`, monitorId != null ? { monitorId } : {})
    },
    {
      name: 'run_cron_monitors_ping',
      description: 'Call /api/cron/monitors-ping (all projects) using MONITOR_CRON_SECRET. force=true ignores schedules.',
      write: true,
      cron: true,
      schema: { force: z.boolean().default(false) },
      run: async ({ force }) =>
        client.request('POST', '/api/cron/monitors-ping', {
          auth: 'none',
          query: force ? { force: '1' } : undefined,
          headers: { authorization: `Bearer ${client.cronSecret}` }
        })
    }
  ];
}

export { text };
