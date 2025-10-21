#!/bin/sh
set -e

echo "Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

echo "Running database migrations..."
npx prisma db push 

echo "Database is ready!"
echo "Starting server..."
exec node server.js

