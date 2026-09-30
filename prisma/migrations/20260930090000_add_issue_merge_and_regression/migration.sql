-- AlterTable: track merged fingerprints and regressions on issues
ALTER TABLE "Issue" ADD COLUMN "mergedFingerprints" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Issue" ADD COLUMN "regressedAt" TIMESTAMP(3);
