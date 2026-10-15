# EDT

EDT wraps deployable tools. **Simple Sentry Endpoint keeps working as before** — same landing, login, dashboard, monitors, and ingest. EDT Hub is an extra catalog at `/hub`.

## Quick start

```bash
npm install
npm run dev
# → http://localhost:3000          Sentry Monitor landing (unchanged)
#    /login · /dashboard · /monitors · /performance · …
#    /hub                          EDT tool catalog
```

## What stayed the same (SSE)

| Path | Behavior |
|------|----------|
| `/` | Original Sentry Monitor landing; signed-in users → `/dashboard` |
| `/login`, `/register`, `/dashboard`, `/projects`, `/performance`, `/monitors`, `/admin`, … | Same as before |
| Ingest APIs (`/api/[id]/envelope`, …) | Unchanged |
| Docker / Prisma | Still `tools/SimpleSentryEndpoint` |

## EDT additions

| Path | What |
|------|------|
| `/hub` | Tool catalog (Sentry + Performance, Monitor, …) |
| App nav “EDT Hub” | Jump to `/hub` without leaving the app |

Runtime: [`tools/SimpleSentryEndpoint`](tools/SimpleSentryEndpoint).
