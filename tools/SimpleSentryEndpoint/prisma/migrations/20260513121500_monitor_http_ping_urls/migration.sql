-- URLs (http/https) the server GETs when running monitor HTTP checks
ALTER TABLE "CronMonitor" ADD COLUMN IF NOT EXISTS "pingUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
