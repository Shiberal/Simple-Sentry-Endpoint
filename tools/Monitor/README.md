# Monitor (EDT tool)

Cron and HTTP uptime monitors — schedules, check-ins, ping URLs, incidents.

## Status

**Product tool in EDT Hub.** The live UI and APIs still run inside [`SimpleSentryEndpoint`](../SimpleSentryEndpoint) at `/monitors` (shared auth + database). This package is the EDT identity for Monitor so Hub can treat it separately from Sentry + Performance.

## Open it

```bash
npm run dev   # from repo root → http://localhost:3000
# then open Monitor from Hub, or go to /monitors
```

## Future

Extract monitor pages/APIs into this package when you want a standalone deploy.
