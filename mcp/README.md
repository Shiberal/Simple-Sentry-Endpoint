# Sentry Monitor MCP server

An [MCP](https://modelcontextprotocol.io) server for a self-hosted Sentry Monitor instance. It talks to the app's existing HTTP API (logs in with a normal user account), so it works against a local or remote deployment and needs no database access.

Transport: stdio. Read-only unless you opt in to writes.

## Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `SENTRY_MONITOR_URL` | Yes | Base URL, for example `https://errors.example.com` |
| `SENTRY_MONITOR_EMAIL`, `SENTRY_MONITOR_PASSWORD` | Yes | Account the server logs in as. It sees the same projects that user can see |
| `SENTRY_MCP_ALLOW_WRITES` | No | Set to `1` to register the write tools below |
| `MONITOR_CRON_SECRET` | No | Same value as on the server; enables `run_cron_monitors_ping` (needs writes enabled too) |

## Run

```bash
cd mcp && npm install
SENTRY_MONITOR_URL=http://localhost:3000 SENTRY_MONITOR_EMAIL=me@example.com SENTRY_MONITOR_PASSWORD=... node src/index.mjs
```

Claude Code: `claude mcp add sentry-monitor -e SENTRY_MONITOR_URL=... -e SENTRY_MONITOR_EMAIL=... -e SENTRY_MONITOR_PASSWORD=... -- node /path/to/mcp/src/index.mjs`

## Tools

Read: `list_projects`, `get_project`, `projects_summary`, `list_releases`, `list_issues`, `get_issue`, `list_issue_comments`, `find_duplicate_issues`, `top_issues`, `list_events`, `get_event`, `error_trends`, `error_breakdown`, `performance_stats`, `performance_timeseries`, `list_monitors`.

Write (need `SENTRY_MCP_ALLOW_WRITES=1`): `update_issue`, `add_issue_comment`, `merge_issues`, `create_monitor`, `update_monitor` (pause/resume), `ping_monitors`, `run_cron_monitors_ping`.

There are deliberately no delete or clear-data tools.

## Tests

`npm test` runs the server against a stub HTTP API.
