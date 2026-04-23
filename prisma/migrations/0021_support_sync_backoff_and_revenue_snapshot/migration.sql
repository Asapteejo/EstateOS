ALTER TYPE "IntegrationSyncStatus" ADD VALUE IF NOT EXISTS 'MAX_RETRIES_EXCEEDED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportPriority') THEN
    CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportRevenueTier') THEN
    CREATE TYPE "SupportRevenueTier" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');
  END IF;
END $$;

ALTER TABLE "SupportRequest"
ADD COLUMN IF NOT EXISTS "supportPriority" "SupportPriority" NOT NULL DEFAULT 'LOW',
ADD COLUMN IF NOT EXISTS "revenueSnapshotAmount" DECIMAL(14,2),
ADD COLUMN IF NOT EXISTS "revenueSnapshotCurrency" TEXT,
ADD COLUMN IF NOT EXISTS "revenueTier" "SupportRevenueTier" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3);
