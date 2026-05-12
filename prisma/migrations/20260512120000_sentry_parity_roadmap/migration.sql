-- AlterEnum add CHECK_IN requires recreating enum in Postgres for Prisma - use safe approach:

CREATE TYPE "EventType_new" AS ENUM ('ERROR', 'CSP', 'MINIDUMP', 'TRANSACTION', 'MESSAGE', 'CHECK_IN');
ALTER TABLE "Event" ALTER COLUMN "eventType" DROP DEFAULT;
ALTER TABLE "Event" ALTER COLUMN "eventType" TYPE "EventType_new" USING ("eventType"::text::"EventType_new");
ALTER TYPE "EventType" RENAME TO "EventType_old";
ALTER TYPE "EventType_new" RENAME TO "EventType";
DROP TYPE "EventType_old";
ALTER TABLE "Event" ALTER COLUMN "eventType" SET DEFAULT 'ERROR'::"EventType";

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "fingerprintByPageUrl" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ingestFilters" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "scrubRules" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "sampleRate" DOUBLE PRECISION;

ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "mergedIntoId" INTEGER;

ALTER TABLE "AlertRule" ADD COLUMN IF NOT EXISTS "slackWebhookUrl" TEXT;
ALTER TABLE "AlertRule" ADD COLUMN IF NOT EXISTS "genericWebhookUrl" TEXT;
ALTER TABLE "AlertRule" ADD COLUMN IF NOT EXISTS "spikeBaselineCount" INTEGER;
ALTER TABLE "AlertRule" ADD COLUMN IF NOT EXISTS "spikeBaselineAt" TIMESTAMP(3);
ALTER TABLE "AlertRule" ALTER COLUMN "emailRecipients" DROP NOT NULL;
ALTER TABLE "AlertRule" ALTER COLUMN "emailRecipients" SET DEFAULT '';

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "promotedPageUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "promotedRelease" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "promotedEnv" TEXT;

CREATE TABLE IF NOT EXISTS "Release" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Release_projectId_version_key" ON "Release"("projectId", "version");
CREATE INDEX IF NOT EXISTS "Release_projectId_lastSeen_idx" ON "Release"("projectId", "lastSeen");

ALTER TABLE "Release" ADD CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DebugFile" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "release" TEXT NOT NULL,
    "dist" TEXT,
    "headerName" TEXT NOT NULL,
    "checksum" TEXT,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebugFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DebugFile_projectId_release_idx" ON "DebugFile"("projectId", "release");
ALTER TABLE "DebugFile" ADD CONSTRAINT "DebugFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CronMonitor" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schedule" TEXT,
    "environment" TEXT,
    "lastCheckInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CronMonitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CronMonitor_projectId_slug_key" ON "CronMonitor"("projectId", "slug");
CREATE INDEX IF NOT EXISTS "CronMonitor_projectId_status_idx" ON "CronMonitor"("projectId", "status");
ALTER TABLE "CronMonitor" ADD CONSTRAINT "CronMonitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MonitorCheckIn" (
    "id" SERIAL NOT NULL,
    "monitorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "environment" TEXT,
    "durationMs" DOUBLE PRECISION,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitorCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MonitorCheckIn_monitorId_createdAt_idx" ON "MonitorCheckIn"("monitorId", "createdAt");
ALTER TABLE "MonitorCheckIn" ADD CONSTRAINT "MonitorCheckIn_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "CronMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN
 ALTER TABLE "Issue" ADD CONSTRAINT "Issue_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Issue_mergedIntoId_idx" ON "Issue"("mergedIntoId");
CREATE INDEX IF NOT EXISTS "Event_projectId_promotedPageUrl_idx" ON "Event"("projectId", "promotedPageUrl");
CREATE INDEX IF NOT EXISTS "Event_projectId_promotedRelease_idx" ON "Event"("projectId", "promotedRelease");
