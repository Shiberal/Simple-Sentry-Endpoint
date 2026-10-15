# Monitor (EDT tool)

Cron and HTTP uptime monitors — schedules, check-ins, ping URLs, incidents.

## Status

**Product tool in EDT Hub.** The live UI and APIs still run inside [`SimpleSentryEndpoint`](../SimpleSentryEndpoint) at `/monitors` (shared auth + database). This package is the EDT identity for Monitor so Hub can treat it separately from Sentry + Performance.

## Open it

- From Hub: **Open in Hub** → Monitor  
- Direct: `http://localhost:3001/monitors` (when SimpleSentryEndpoint is running)  
- Optional local launcher: `npm run dev` here (port **3002**) redirects into the runtime URL

```bash
# .env
MONITOR_RUNTIME_URL=http://localhost:3001/monitors
```

## Future

Extract monitor pages/APIs into this package when you want a standalone deploy.
