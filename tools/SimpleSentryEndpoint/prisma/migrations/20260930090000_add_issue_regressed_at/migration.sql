-- AlterTable: remember when a resolved issue was reopened by a new event
ALTER TABLE "Issue" ADD COLUMN "regressedAt" TIMESTAMP(3);
