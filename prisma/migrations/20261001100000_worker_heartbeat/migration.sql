-- CreateTable: scheduler heartbeats so the Monitors page can show the ping worker is alive
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastTickAt" TIMESTAMP(3) NOT NULL,
    "intervalMs" INTEGER NOT NULL,
    "ticks" INTEGER NOT NULL DEFAULT 0,
    "lastRan" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);
