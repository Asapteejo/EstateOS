ALTER TYPE "FollowUpStatus" ADD VALUE IF NOT EXISTS 'PROMISED_TO_PAY';
ALTER TYPE "FollowUpStatus" ADD VALUE IF NOT EXISTS 'NOT_REACHABLE';

ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Transaction_companyId_followUpStatus_nextFollowUpAt_idx"
ON "Transaction"("companyId", "followUpStatus", "nextFollowUpAt");
