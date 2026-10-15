-- AlterTable: short-lived key used to pair a Telegram chat with a project. Additive and nullable.
ALTER TABLE "Project"
  ADD COLUMN "telegramLinkKey" TEXT,
  ADD COLUMN "telegramLinkExpires" TIMESTAMP(3);
