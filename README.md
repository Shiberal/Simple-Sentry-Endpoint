# Sentry Monitor

Self-hosted error tracking and monitoring. Ingest events from [Sentry](https://sentry.io) SDKs (and compatible clients), group them into issues, and manage them with a web dashboard. Optional integrations: GitHub (auto-create issues), Telegram, and email alerts.

## Features

- **Sentry-compatible ingestion** — Use Sentry SDKs with your project DSN; events hit this server instead of Sentry’s cloud
- **Issue grouping** — Errors are grouped by fingerprint with status (Unresolved, Resolved, In Progress, Ignored)
- **Event types** — Errors, CSP reports, minidumps, transactions, messages
- **Dashboard** — Projects, issues, event detail, performance views, and analytics
- **Integrations** — GitHub (auto-create issues), Telegram notifications, email alert rules
- **Auth** — Register, login, project members, and admin panel

## Tech stack

- **Next.js 16** (Pages Router) — API routes and UI
- **Prisma** — PostgreSQL ORM
- **Sentry (Next.js)** — Frontend error monitoring (optional; tunnel at `/monitoring`)

## Prerequisites

- Node.js 20+
- PostgreSQL
- (Optional) SMTP server and/or Telegram bot for alerts

## Environment variables

Create a `.env` in the project root:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/sentry_monitor` |
| `NEXT_PUBLIC_BASE_URL` | No | Public base URL (for DSN and links), e.g. `https://errors.example.com` |
| `TELEGRAM_BOT_TOKEN` | No | Bot token for Telegram notifications |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No | SMTP settings for email alerts |
| `EMAIL_FROM` | No | From address for emails (defaults to `SMTP_USER`) |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure database

Set `DATABASE_URL` in `.env`, then generate the Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 3. Run the app

**Development (with Turbopack):**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register a user, create a project, and use the project’s DSN in your Sentry SDK.

**Production:**

```bash
npm run build
npm run start
```

To run migrations before starting (e.g. in deployment):

```bash
npm run start:migrate
```

## Sentry SDK setup

Point your app’s Sentry DSN to this server:

- **DSN format:** `https://<key>@<host>/<project_id>`
- **Host:** Your server’s base URL (e.g. `https://errors.example.com` or `http://localhost:3000`)
- **Project ID:** Shown in the project settings in the dashboard (numeric).
- **Key:** The project key from the same settings.

Example for a Next.js app:

```js
// sentry.client.config.js or equivalent
Sentry.init({
  dsn: 'https://your-project-key@https://errors.example.com/1',
  // ...
});
```

Ingestion endpoints (used by the SDK automatically):

- `POST /api/[id]/envelope` — Envelope (primary)
- `POST /api/[id]/store` — Legacy store
- `POST /api/[id]/minidump` — Native crash minidumps
- `POST /api/[id]/security` — CSP / security reports

## Database commands

```bash
# Regenerate Prisma client after schema changes
npm run prisma:generate

# Create and apply migrations (development)
npm run prisma:migrate

# Apply migrations only (production)
npm run prisma:migrate:deploy

# Open Prisma Studio (DB GUI)
npm run prisma:studio
```

## Docker

Build and run with Docker. The image runs migrations (via `prisma db push`) then starts the server.

```bash
docker build -t sentry-monitor .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." sentry-monitor
```

Ensure `DATABASE_URL` is set (required by `docker-entrypoint.sh`).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Prisma generate + Next.js build |
| `npm run start` | Start production server |
| `npm run start:migrate` | Run migrations then start |
| `npm run lint` | Run ESLint |

## Project structure (overview)

- `src/pages/` — Next.js pages (dashboard, project, login, admin, etc.) and API routes
- `src/pages/api/[id]/` — Sentry ingestion: `envelope`, `store`, `minidump`, `security`
- `src/pages/api/auth/` — Login, register, logout, me
- `src/pages/api/projects/`, `issues/`, `events/`, `analytics/` — CRUD and analytics
- `src/lib/` — Prisma client, GitHub, Telegram, email, Sentry helpers
- `prisma/schema.prisma` — Data models (User, Project, Issue, Event, Comment, AlertRule, SystemSettings)

## License

Private — see repository settings.
