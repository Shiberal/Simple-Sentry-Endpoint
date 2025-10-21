-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ERROR', 'CSP', 'MINIDUMP', 'TRANSACTION', 'MESSAGE');

-- AlterTable: Add CSP-specific fields to Issue
ALTER TABLE "Issue" ADD COLUMN     "violatedDirective" TEXT,
ADD COLUMN     "blockedUri" TEXT,
ADD COLUMN     "sourceFile" TEXT;

-- AlterTable: Add eventType field to Event with default value
ALTER TABLE "Event" ADD COLUMN     "eventType" "EventType" NOT NULL DEFAULT 'ERROR';

-- CreateIndex
CREATE INDEX "Event_projectId_eventType_idx" ON "Event"("projectId", "eventType");

