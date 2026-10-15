# EDT

One app. **Landing + login at `/`**, **Hub at `/hub`**, **Sentry issues at `/hub/sentry`** (former dashboard).

## Quick start

```bash
npm install
npm run dev
# → http://localhost:3000     EDT landing (sign in → Sentry)
#    /hub                     Status glance (active issues · monitors)
#    /hub/sentry              Issues workspace (was /dashboard)
#    /monitors                Monitor
#    /dashboard               Gone (404)
```

## Routes

| Path | Behavior |
|------|----------|
| `/` | EDT landing; login → `/hub/sentry` |
| `/hub` | Status glance (not a second tool catalog) |
| `/hub/sentry` | Issues UI (old dashboard) |
| `/dashboard` | Nothing (404) |
| Ingest APIs | Unchanged |

Same `DATABASE_URL` keeps your data. See [DATA.md](DATA.md).

## Deploy (Coolify)

Coolify builds the **repo-root** `Dockerfile`, which packages `tools/SimpleSentryEndpoint`. Keep `DATABASE_URL` pointed at your existing Postgres. Local tool builds still use `tools/SimpleSentryEndpoint/Dockerfile`.
