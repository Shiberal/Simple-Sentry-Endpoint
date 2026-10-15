# Preserving data through EDT

EDT is a **folder move**, not a new product database.

## Database

1. Keep your existing `DATABASE_URL` (PostgreSQL).
2. Put it in either:
   - repo root `.env` (still loaded), or
   - `tools/SimpleSentryEndpoint/.env`
3. On deploy/start, the app runs `prisma migrate deploy` — applies pending migrations only; it does **not** wipe tables.
4. Never run `prisma db push --accept-data-loss` on a database you care about.

If `migrate deploy` complains that the DB was previously synced only with `db push`, baseline once (does not delete rows):

```bash
cd tools/SimpleSentryEndpoint
npx prisma migrate resolve --applied "<migration_name>"
# repeat for migrations already reflected in the DB, then:
npx prisma migrate deploy
```

## Files on disk

| Data | How it is kept |
|------|----------------|
| Issues, events, users, monitors | Postgres via `DATABASE_URL` |
| Sourcemaps / debug files | `DEBUG_FILES_DIR` or compose volume `*_debug_files` |
| Env / secrets | Same `.env` values as before |

## Compose

Root `docker-compose.yml` and `tools/SimpleSentryEndpoint/docker-compose.yml` both:

- read `.env` from the repo root and/or the tool directory
- pass through `DATABASE_URL`
- mount a named volume for debug files
