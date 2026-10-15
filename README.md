# EDT

EDT is a toolbox of deployable tools. **One app, one port:** Hub is the main page at `/`.

## Quick start

```bash
npm install
npm run dev
# → http://localhost:3000   (EDT Hub)
#    /dashboard · /performance  → Sentry + Performance
#    /monitors                  → Monitor
```

## Tools

| Tool | Where | What it is |
|------|--------|------------|
| **Hub** | `/` | Catalog / home |
| **Sentry + Performance** | `/dashboard`, `/performance`, `/projects` | Error sink & performance |
| **Monitor** | `/monitors` | Cron / HTTP uptime |

Runtime package: [`tools/SimpleSentryEndpoint`](tools/SimpleSentryEndpoint). Catalog stubs: [`tools/Monitor`](tools/Monitor), [`tools/SentryPerformance`](tools/SentryPerformance), [`tools/Hub`](tools/Hub).

## Layout

```
EDT/
  tools/
    SimpleSentryEndpoint/   # the runnable app (Hub + tools)
    Hub/                    # design notes / future extract
    Monitor/
    SentryPerformance/
```
