# Sentry + Performance (EDT tool)

Issues, events, projects, and performance — the error-sink half of the old Simple Sentry app.

## Runtime

Implemented by [`../SimpleSentryEndpoint`](../SimpleSentryEndpoint) (`@edt/simple-sentry-endpoint`). Hub lists this as its own tool next to **Monitor**.

```bash
cd ../SimpleSentryEndpoint
npm run dev   # http://localhost:3000
```

Primary paths: `/dashboard`, `/performance`, `/projects`.
