#!/bin/sh
set -e

echo "Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Never use `db push --accept-data-loss` here — that can destroy production data.
# migrate deploy only applies pending migration files and leaves existing rows alone.
echo "Applying Prisma migrations (migrate deploy)..."
set +e
migrate_out=$(npx prisma migrate deploy 2>&1)
migrate_status=$?
set -e
printf '%s\n' "$migrate_out"

if [ "$migrate_status" -ne 0 ]; then
  # P3005: non-empty DB with no _prisma_migrations history (typical after db push).
  # Mark checked-in migrations as already applied — does not run SQL or delete rows.
  if printf '%s\n' "$migrate_out" | grep -q 'P3005'; then
    echo "Database already has a schema but no migration history — baselining..."
    for dir in prisma/migrations/*/; do
      [ -d "$dir" ] || continue
      name=$(basename "$dir")
      echo "  prisma migrate resolve --applied $name"
      npx prisma migrate resolve --applied "$name"
    done
    echo "Retrying migrate deploy..."
    npx prisma migrate deploy
  else
    echo "ERROR: prisma migrate deploy failed (not a baseline case)."
    exit "$migrate_status"
  fi
fi

echo "Database is ready!"

# Scheduled monitor pings need something to run them. Start the ping worker next to the web
# server unless it is turned off (ENABLE_PING_WORKER=false, e.g. when a separate worker
# container runs it) or the in-process pinger is enabled (it would ping everything twice).
case "$ENABLE_MONITOR_HTTP_PINGER" in
  true|1) PING_WORKER_IN_PROCESS=true ;;
  *) PING_WORKER_IN_PROCESS=false ;;
esac

if [ "$ENABLE_PING_WORKER" != "false" ] && [ "$PING_WORKER_IN_PROCESS" = "false" ]; then
  echo "Starting monitor ping worker..."
  # Restart it if it ever exits; it only reads the database, so a restart is harmless
  (
    while true; do
      node scripts/monitor-ping-worker.mjs || true
      echo "[monitor-ping-worker] exited, restarting in 5s"
      sleep 5
    done
  ) &
else
  echo "Monitor ping worker not started by the entrypoint (ENABLE_PING_WORKER=$ENABLE_PING_WORKER, ENABLE_MONITOR_HTTP_PINGER=$ENABLE_MONITOR_HTTP_PINGER)"
fi

echo "Starting server..."
exec node server.js
