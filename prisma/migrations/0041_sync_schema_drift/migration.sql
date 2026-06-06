-- Additive catch-up for schema objects that existed via db push/manual setup but
-- were missing from the committed migration replay.
DO $$
BEGIN
  CREATE TYPE "MarketerCommissionStatus" AS ENUM ('PENDING', 'PAID', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CustomDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "customDomainStatus" "CustomDomainStatus" DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "customDomainVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Property"
ADD COLUMN IF NOT EXISTS "isMarketplaceListed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SignedAgreement"
ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "acceptedByIp" TEXT,
ADD COLUMN IF NOT EXISTS "acceptedByUserAgent" TEXT,
ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "overdueReminderStage" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "MarketerCommissionRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feeType" "CommissionType" NOT NULL,
    "flatAmount" DECIMAL(12,2),
    "percentageRate" DECIMAL(5,2),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "propertyType" "PropertyType",
    "propertyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketerCommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketerCommission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "transactionId" TEXT,
    "ruleId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "MarketerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketerCommission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketerCommissionRule_companyId_isActive_idx"
ON "MarketerCommissionRule"("companyId", "isActive");

CREATE INDEX IF NOT EXISTS "MarketerCommissionRule_companyId_propertyType_isActive_idx"
ON "MarketerCommissionRule"("companyId", "propertyType", "isActive");

CREATE INDEX IF NOT EXISTS "MarketerCommissionRule_companyId_propertyId_isActive_idx"
ON "MarketerCommissionRule"("companyId", "propertyId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "MarketerCommission_paymentId_key"
ON "MarketerCommission"("paymentId");

CREATE INDEX IF NOT EXISTS "MarketerCommission_companyId_marketerId_idx"
ON "MarketerCommission"("companyId", "marketerId");

CREATE INDEX IF NOT EXISTS "MarketerCommission_companyId_status_idx"
ON "MarketerCommission"("companyId", "status");

CREATE INDEX IF NOT EXISTS "MarketerCommission_marketerId_status_createdAt_idx"
ON "MarketerCommission"("marketerId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Property_isMarketplaceListed_isPubliclyVisible_status_idx"
ON "Property"("isMarketplaceListed", "isPubliclyVisible", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "SignedAgreement_documentId_key"
ON "SignedAgreement"("documentId");

CREATE INDEX IF NOT EXISTS "SignedAgreement_companyId_status_idx"
ON "SignedAgreement"("companyId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_companyId_staffCode_key"
ON "TeamMember"("companyId", "staffCode");

DO $$
BEGIN
  ALTER TABLE "MarketerCommissionRule"
  ADD CONSTRAINT "MarketerCommissionRule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketerCommissionRule"
  ADD CONSTRAINT "MarketerCommissionRule_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketerCommission"
  ADD CONSTRAINT "MarketerCommission_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketerCommission"
  ADD CONSTRAINT "MarketerCommission_marketerId_fkey"
  FOREIGN KEY ("marketerId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketerCommission"
  ADD CONSTRAINT "MarketerCommission_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketerCommission"
  ADD CONSTRAINT "MarketerCommission_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketerCommission"
  ADD CONSTRAINT "MarketerCommission_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "MarketerCommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SignedAgreement"
  ADD CONSTRAINT "SignedAgreement_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SignedAgreement"
  ADD CONSTRAINT "SignedAgreement_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
