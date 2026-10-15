#!/bin/sh
set -e

echo "Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

echo "Running database migrations..."
npx prisma db push --accept-data-loss 

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
