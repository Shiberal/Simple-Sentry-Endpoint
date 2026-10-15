# EDT tools

| Folder | Package | Role |
|--------|---------|------|
| [Hub](./Hub) | `@edt/hub` | Shell UI |
| [Monitor](./Monitor) | `@edt/monitor` | Monitor tool identity / launcher |
| [SentryPerformance](./SentryPerformance) | catalog | Points at SimpleSentryEndpoint |
| [SimpleSentryEndpoint](./SimpleSentryEndpoint) | `@edt/simple-sentry-endpoint` | Shared runtime |

Add a tool: folder + `edt-tool.json` + Hub registry entry in `Hub/src/lib/tools.js`.
