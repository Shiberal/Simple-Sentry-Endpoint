# Sentry Monitor

**Not affiliated with Sentry.** This project is independent software. It is not made by, endorsed by, or officially related to [Sentry](https://sentry.io) (Functional Software, Inc.) or the Sentry SaaS product. It only speaks the same client protocol so you can use the public Sentry SDKs with your own server.

A self-hosted app that collects errors and monitoring data from [Sentry](https://sentry.io) SDKs (and similar clients). Events land on your server, get grouped into issues, and you manage everything in a web UI. You can optionally connect GitHub, Telegram, and email for alerts.

## What it does

- Accepts the same kind of traffic Sentry’s cloud would, but on your own machine or host.
- Groups similar errors into issues you can open, resolve, or ignore.
- Handles several event kinds: errors, content security policy (CSP) reports, minidumps, performance transactions, and messages.
- Gives you a dashboard for projects, issues, single events, performance, and simple analytics.
- Supports sign-up, login, who can access each project, and an admin area.

## What it is built with

- Next.js 16 (pages router) for the website and API.
- Prisma with PostgreSQL for the database.
- Optional Sentry for the monitor app itself (tunnel path `/monitoring` if you use it).

## What you need

- Node.js 20 or newer.
- A PostgreSQL database.
- Optional: SMTP for email alerts, or a Telegram bot for Telegram alerts.

## Configuration

Create a `.env` file in the project root:

| Variable | Required | What it is for |
|----------|----------|----------------|
| `DATABASE_URL` | Yes | PostgreSQL URL, for example `postgresql://user:password@localhost:5432/sentry_monitor` |
| `NEXT_PUBLIC_BASE_URL` | No | Public site URL (helps with DSNs and links), for example `https://errors.example.com` |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for notifications |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No | Mail server settings for email alerts |
| `EMAIL_FROM` | No | Sender address for mail (if omitted, `SMTP_USER` is used) |
| `ENABLE_MONITOR_HTTP_PINGER` | No | Set to `true` to run scheduled monitor HTTP pings from the Next.js server process |
| `MONITOR_HTTP_PINGER_INTERVAL_MS` | No | How often the server checks for due monitor pings; defaults to `60000` when enabled |
| `MONITOR_HTTP_PING_FALLBACK_INTERVAL_MS` | No | Fallback interval for monitors without a valid cron schedule; defaults to 5 minutes |
| `MONITOR_HTTP_RETRY_COUNT` | No | Failed monitor HTTP pings are retried this many times before recording an error; defaults to `2` |
| `MONITOR_HTTP_RETRY_DELAY_MS` | No | Delay between monitor HTTP ping retries; defaults to `10000` |
| `MONITOR_CRON_SECRET` | No | Secret for external calls to `/api/cron/monitors-ping` |

## Local setup

1. Install packages:

   ```bash
   npm install
   ```

2. Point `DATABASE_URL` at your database in `.env`, then prepare the schema:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

3. Run in development:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Register, create a project, then copy that project’s DSN into your app’s Sentry setup.

4. Production build and run:

   ```bash
   npm run build
   npm run start
   ```

   To apply database migrations before starting (typical on a server):

   ```bash
   npm run start:migrate
   ```

## Pointing the Sentry SDK at this server

Your DSN tells the SDK where to send data. Format:

`https://<key>@<host>/<project_id>`

- **host**: Your site’s base URL (for example `https://errors.example.com` or `http://localhost:3000`).
- **project_id**: The number shown for the project in the UI.
- **key**: The project key from the same project settings.

Example:

```js
Sentry.init({
  dsn: 'https://your-project-key@https://errors.example.com/1',
});
```

Main ingestion paths (the SDK usually picks these for you):

- `POST /api/[id]/envelope` — main path
- `POST /api/[id]/store` — older store API
- `POST /api/[id]/minidump` — native crash dumps
- `POST /api/[id]/security` — CSP and security reports

## Cron monitors

Create monitor slugs in the Monitors page before sending SDK check-ins or adding HTTP ping URLs. The `schedule` field is a 5-field cron expression such as `*/5 * * * *`.

For Docker deployments, scheduled HTTP pings are enabled by default and the server checks once per minute for monitors that are due. For non-Docker Node deployments, set:

```bash
ENABLE_MONITOR_HTTP_PINGER=true
MONITOR_HTTP_PINGER_INTERVAL_MS=60000
```

If you prefer an external scheduler, set `MONITOR_CRON_SECRET` and call:

```text
GET /api/cron/monitors-ping?secret=<MONITOR_CRON_SECRET>
```

Add `force=1` to that URL when you want to ping all configured URLs immediately instead of only monitors whose schedule is due.

## Database helpers

```bash
npm run prisma:generate          # After schema changes
npm run prisma:migrate           # Create and apply migrations (development)
npm run prisma:migrate:deploy    # Apply migrations only (production)
npm run prisma:studio            # Open a simple database browser
```

## Docker

The Docker image runs `prisma db push` (with `--accept-data-loss`) on startup, then starts the app. You must set `DATABASE_URL`.

```bash
docker build -t sentry-monitor .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." sentry-monitor
```

`db push` syncs the schema to the database without using migration files. For production where you rely on migrations, prefer `npm run start:migrate` on a normal Node deployment instead of relying on `db push` in Docker unless you accept that tradeoff.

## npm scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Generate Prisma client and build Next.js |
| `npm run start` | Production server |
| `npm run start:migrate` | Run migrations, then production server |
| `npm run lint` | ESLint |

## Folder map

- `src/pages/` — UI pages (dashboard, project, login, admin, and so on) plus API routes under `src/pages/api/`.
- `src/pages/api/[id]/` — Ingestion: `envelope`, `store`, `minidump`, `security`.
- `src/pages/api/auth/` — Register, login, logout, current user.
- `src/pages/api/projects/`, `issues/`, `events/`, `analytics/` — App data and charts.
- `src/lib/` — Database client, GitHub, Telegram, email, Sentry helpers.
- `prisma/schema.prisma` — Models such as User, Project, Issue, Event, comments, alert rules, system settings.

## License

Licensed under the [MPL](LICENSE).
