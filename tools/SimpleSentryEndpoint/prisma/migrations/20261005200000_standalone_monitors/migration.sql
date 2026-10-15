-- Standalone monitors: not part of a project, owned by a user. Additive; existing monitors keep their project.
ALTER TABLE "CronMonitor" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "CronMonitor" ADD COLUMN "ownerId" INTEGER;
ALTER TABLE "CronMonitor" ADD CONSTRAINT "CronMonitor_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CronMonitor_ownerId_slug_key" ON "CronMonitor"("ownerId", "slug");
