# EDT

EDT is a toolbox of deployable tools. Each tool is a self-contained app under `tools/` — its own package, Docker image, and docs — so you can run one tool or many side by side.

## Tools

| Tool | Path | What it is |
|------|------|------------|
| **SimpleSentryEndpoint** | [`tools/SimpleSentryEndpoint`](tools/SimpleSentryEndpoint) | Self-hosted Sentry-compatible error sink and monitor UI |

More tools will land here over time.

## Layout

```
EDT/
  package.json          # npm workspaces root
  tools/
    SimpleSentryEndpoint/
      …                 # Next.js app, Prisma, Docker
    <NextTool>/
```

## Quick start (SimpleSentryEndpoint)

```bash
cd tools/SimpleSentryEndpoint
cp .env.example .env   # if you have one; otherwise create .env with DATABASE_URL
npm install
npm run dev
```

From the EDT root (after `npm install` at the root):

```bash
npm run dev:simple-sentry
```

Docker from the tool directory:

```bash
cd tools/SimpleSentryEndpoint
docker compose up --build
```

Or from the EDT root:

```bash
docker compose -f tools/SimpleSentryEndpoint/docker-compose.yml up --build
```

## Adding a tool

1. Create `tools/<ToolName>/` with its own `package.json` (`name` preferably `@edt/<kebab-name>`).
2. Keep the tool runnable alone (`npm run dev` / Docker from that folder).
3. Optionally add root scripts like `dev:<tool>` and a row in the table above.
