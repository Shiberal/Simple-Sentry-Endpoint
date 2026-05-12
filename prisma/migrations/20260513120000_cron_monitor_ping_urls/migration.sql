-- Server-side HTTP check targets for cron monitors (list of URLs to GET)
ALTER TABLE "CronMonitor" ADD COLUMN IF NOT EXISTS "pingUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
