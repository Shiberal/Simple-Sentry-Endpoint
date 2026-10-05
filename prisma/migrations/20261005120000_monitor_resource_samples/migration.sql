-- Additive: per-monitor report token and CPU/RAM time-series pushed by the monitored service
ALTER TABLE "CronMonitor" ADD COLUMN "reportToken" TEXT;
CREATE UNIQUE INDEX "CronMonitor_reportToken_key" ON "CronMonitor"("reportToken");

CREATE TABLE "MonitorResourceSample" (
    "id" SERIAL NOT NULL,
    "monitorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION,
    "memUsedBytes" DOUBLE PRECISION,
    "memLimitBytes" DOUBLE PRECISION,
    "cpuLimitCores" DOUBLE PRECISION,

    CONSTRAINT "MonitorResourceSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonitorResourceSample_monitorId_createdAt_idx" ON "MonitorResourceSample"("monitorId", "createdAt");

ALTER TABLE "MonitorResourceSample" ADD CONSTRAINT "MonitorResourceSample_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "CronMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
