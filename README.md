# EDT

EDT is a toolbox of deployable tools. The **Hub** opens them in one place; each tool still has its own package under `tools/`.

## Tools

| Tool | Path | Port | What it is |
|------|------|------|------------|
| **Hub** | [`tools/Hub`](tools/Hub) | 3100 | Web UI to launch / embed tools |
| **Sentry + Performance** | [`tools/SimpleSentryEndpoint`](tools/SimpleSentryEndpoint) · catalog [`SentryPerformance`](tools/SentryPerformance) | 3000 | Error sink, issues, performance |
| **Monitor** | [`tools/Monitor`](tools/Monitor) | 3002 → 3000/monitors | Cron / HTTP uptime monitors |

## Quick start

```bash
# Terminal 1 — Sentry + Performance runtime (also serves /monitors today)
cd tools/SimpleSentryEndpoint && npm install && npm run dev

# Terminal 2 — EDT Hub
cd tools/Hub && npm install && npm run dev
# → http://localhost:3100
```

From the repo root (after `npm install`):

```bash
npm run dev:sentry   # :3000
npm run dev:hub      # :3100
```

Optional env for Hub:

```bash
NEXT_PUBLIC_TOOL_SENTRY_URL=http://localhost:3000
NEXT_PUBLIC_TOOL_MONITOR_URL=http://localhost:3000/monitors
```

On the Sentry app, allow Hub to iframe it:

```bash
EDT_HUB_ORIGIN=http://localhost:3100
```

## Layout

```
EDT/
  PRODUCT.md / DESIGN.md
  tools/
    Hub/                  # @edt/hub
    Monitor/              # @edt/monitor (EDT identity + launcher)
    SentryPerformance/    # catalog pointer
    SimpleSentryEndpoint/ # @edt/simple-sentry-endpoint (runtime)
```

## Adding a tool

1. Add `tools/<Name>/` with `package.json` (`@edt/...`) and `edt-tool.json`.
2. Register it in `tools/Hub/src/lib/tools.js`.
3. Keep it runnable alone when possible.
