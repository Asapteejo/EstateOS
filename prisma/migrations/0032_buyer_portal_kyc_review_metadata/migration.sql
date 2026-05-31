ALTER TABLE "KYCSubmission"
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "requiredActions" TEXT;

UPDATE "KYCSubmission"
SET "reviewedByUserId" = "reviewedById"
WHERE "reviewedById" IS NOT NULL
  AND "reviewedByUserId" IS NULL;

CREATE INDEX "KYCSubmission_companyId_reviewedAt_idx" ON "KYCSubmission"("companyId", "reviewedAt");
