-- AlterTable: host an event came from, so one project key can be split by source. Nullable, additive.
ALTER TABLE "Event" ADD COLUMN "promotedOrigin" TEXT;
CREATE INDEX "Event_projectId_promotedOrigin_idx" ON "Event"("projectId", "promotedOrigin");
-- Backfill from the page URL for existing events
UPDATE "Event" SET "promotedOrigin" = lower(substring("promotedPageUrl" from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+)')) WHERE "promotedPageUrl" IS NOT NULL;
