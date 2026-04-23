DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupportRequestCategory'
  ) THEN
    CREATE TYPE "SupportRequestCategory" AS ENUM (
      'BUG',
      'FEATURE_REQUEST',
      'QUESTION',
      'BILLING',
      'ONBOARDING',
      'OTHER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'IntegrationSyncStatus'
  ) THEN
    CREATE TYPE "IntegrationSyncStatus" AS ENUM (
      'PENDING',
      'SYNCED',
      'FAILED',
      'SKIPPED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SupportRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "category" "SupportRequestCategory" NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "reporterName" TEXT,
  "reporterEmail" TEXT,
  "pageUrl" TEXT,
  "browserInfo" TEXT,
  "companyPlanLabel" TEXT,
  "syncStatus" "IntegrationSyncStatus" NOT NULL DEFAULT 'PENDING',
  "linearIssueId" TEXT,
  "linearIssueIdentifier" TEXT,
  "linearIssueUrl" TEXT,
  "lastSyncError" TEXT,
  "syncedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportRequest_companyId_createdAt_idx"
ON "SupportRequest"("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "SupportRequest_companyId_category_createdAt_idx"
ON "SupportRequest"("companyId", "category", "createdAt");

CREATE INDEX IF NOT EXISTS "SupportRequest_syncStatus_createdAt_idx"
ON "SupportRequest"("syncStatus", "createdAt");

CREATE INDEX IF NOT EXISTS "SupportRequest_userId_createdAt_idx"
ON "SupportRequest"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupportRequest_companyId_fkey'
      AND conrelid = 'public."SupportRequest"'::regclass
  ) THEN
    ALTER TABLE "SupportRequest"
    ADD CONSTRAINT "SupportRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupportRequest_userId_fkey'
      AND conrelid = 'public."SupportRequest"'::regclass
  ) THEN
    ALTER TABLE "SupportRequest"
    ADD CONSTRAINT "SupportRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
