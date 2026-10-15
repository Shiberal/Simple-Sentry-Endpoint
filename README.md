# EDT

EDT is a toolbox of deployable tools. **Hub is the main page** (`http://localhost:3000`). Other tools run beside it and open from Hub.

## Tools

| Tool | Path | Port | What it is |
|------|------|------|------------|
| **Hub** (main) | [`tools/Hub`](tools/Hub) | **3000** | Web UI to launch / embed tools |
| **Sentry + Performance** | [`tools/SimpleSentryEndpoint`](tools/SimpleSentryEndpoint) · catalog [`SentryPerformance`](tools/SentryPerformance) | 3001 | Error sink, issues, performance |
| **Monitor** | [`tools/Monitor`](tools/Monitor) | 3002 → 3001/monitors | Cron / HTTP uptime monitors |

## Quick start

```bash
npm install

# Terminal 1 — main page (Hub)
npm run dev
# → http://localhost:3000

# Terminal 2 — Sentry + Performance runtime (also serves /monitors)
npm run dev:sentry
# → http://localhost:3001
```

Optional Hub env (`tools/Hub/.env`):

```bash
NEXT_PUBLIC_TOOL_SENTRY_URL=http://localhost:3001
NEXT_PUBLIC_TOOL_MONITOR_URL=http://localhost:3001/monitors
```

Allow Hub to iframe tools (on the Sentry app):

```bash
EDT_HUB_ORIGIN=http://localhost:3000
```

## Layout

```
EDT/
  PRODUCT.md / DESIGN.md
  tools/
    Hub/                  # @edt/hub  ← main page :3000
    Monitor/              # @edt/monitor
    SentryPerformance/    # catalog pointer
    SimpleSentryEndpoint/ # @edt/simple-sentry-endpoint :3001
```

## Adding a tool

1. Add `tools/<Name>/` with `package.json` (`@edt/...`) and `edt-tool.json`.
2. Register it in `tools/Hub/src/lib/tools.js`.
3. Keep it runnable alone when possible.
