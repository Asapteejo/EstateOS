ALTER TABLE "SupportRequest"
ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastRetryAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SupportRequest_companyId_syncStatus_nextRetryAt_idx"
ON "SupportRequest"("companyId", "syncStatus", "nextRetryAt");
