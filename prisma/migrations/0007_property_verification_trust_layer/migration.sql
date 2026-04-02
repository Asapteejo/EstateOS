CREATE TYPE "PropertyVerificationStatus" AS ENUM ('VERIFIED', 'STALE', 'UNVERIFIED', 'HIDDEN');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROPERTY_VERIFICATION_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROPERTY_HIDDEN';

ALTER TABLE "Property"
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "verificationStatus" "PropertyVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "verificationDueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "isPubliclyVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoHiddenAt" TIMESTAMP(3),
ADD COLUMN "verificationNotes" TEXT,
ADD COLUMN "verificationWarningSentAt" TIMESTAMP(3),
ADD COLUMN "hiddenNotificationSentAt" TIMESTAMP(3);

UPDATE "Property"
SET
  "lastVerifiedAt" = CASE
    WHEN "status" IN ('AVAILABLE', 'RESERVED', 'SOLD') THEN COALESCE("updatedAt", CURRENT_TIMESTAMP)
    ELSE NULL
  END,
  "verificationStatus" = CASE
    WHEN "status" IN ('AVAILABLE', 'RESERVED', 'SOLD') THEN 'VERIFIED'::"PropertyVerificationStatus"
    WHEN "status" = 'ARCHIVED' THEN 'HIDDEN'::"PropertyVerificationStatus"
    ELSE 'UNVERIFIED'::"PropertyVerificationStatus"
  END,
  "verificationDueAt" = CASE
    WHEN "status" IN ('AVAILABLE', 'RESERVED', 'SOLD') THEN COALESCE("updatedAt", CURRENT_TIMESTAMP) + INTERVAL '7 days'
    ELSE CURRENT_TIMESTAMP
  END,
  "isPubliclyVisible" = CASE
    WHEN "status" IN ('AVAILABLE', 'RESERVED', 'SOLD') THEN true
    ELSE false
  END,
  "autoHiddenAt" = CASE
    WHEN "status" = 'ARCHIVED' THEN CURRENT_TIMESTAMP
    ELSE NULL
  END;

CREATE INDEX "Property_companyId_verificationStatus_verificationDueAt_idx"
ON "Property"("companyId", "verificationStatus", "verificationDueAt");

CREATE INDEX "Property_companyId_isPubliclyVisible_status_idx"
ON "Property"("companyId", "isPubliclyVisible", "status");
