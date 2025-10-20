#!/bin/sh
set -e

echo "Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

echo "Running database migrations..."
npx prisma migrate deploy || {
  echo "Migrate deploy failed, trying db push..."
  npx prisma db push --accept-data-loss
}

echo "Database is ready!"
echo "Starting server..."
exec node server.js

