ALTER TABLE "Transaction"
ADD COLUMN "followUpStatus" "FollowUpStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "followUpNote" TEXT,
ADD COLUMN "lastFollowedUpAt" TIMESTAMP(3);

CREATE INDEX "Transaction_companyId_followUpStatus_lastFollowedUpAt_idx"
ON "Transaction"("companyId", "followUpStatus", "lastFollowedUpAt");
