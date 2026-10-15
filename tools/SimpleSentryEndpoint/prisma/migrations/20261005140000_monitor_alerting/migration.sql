-- AlterTable: per-monitor alerting. Additive only; every column has a default so existing rows are untouched.
ALTER TABLE "CronMonitor"
  ADD COLUMN "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "failureThreshold" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "alertEmails" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "alertSlackUrl" TEXT,
  ADD COLUMN "alertWebhookUrl" TEXT,
  ADD COLUMN "alertState" TEXT NOT NULL DEFAULT 'ok',
  ADD COLUMN "alertedAt" TIMESTAMP(3);
