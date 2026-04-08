CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

CREATE TYPE "AnalyticsScope" AS ENUM ('PLATFORM', 'COMPANY');

ALTER TABLE "Company"
ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspensionReason" TEXT;

CREATE TABLE "AnalyticsDailySnapshot" (
    "id" TEXT NOT NULL,
    "scope" "AnalyticsScope" NOT NULL,
    "scopeKey" TEXT NOT NULL DEFAULT 'global',
    "companyId" TEXT,
    "bucketDate" TIMESTAMP(3) NOT NULL,
    "totalCompanies" INTEGER NOT NULL DEFAULT 0,
    "activeCompanies" INTEGER NOT NULL DEFAULT 0,
    "newCompanies" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "reservationCount" INTEGER NOT NULL DEFAULT 0,
    "dealCount" INTEGER NOT NULL DEFAULT 0,
    "paymentRequestCount" INTEGER NOT NULL DEFAULT 0,
    "successfulPaymentCount" INTEGER NOT NULL DEFAULT 0,
    "overdueCount" INTEGER NOT NULL DEFAULT 0,
    "platformInflow" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subscriptionRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "platformRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overdueAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalOutstandingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overdueRecoveredAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "avgDaysToCollect" DECIMAL(8,2),
    "companyStatus" "CompanyStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsDailySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsDailySnapshot_scope_scopeKey_bucketDate_key" ON "AnalyticsDailySnapshot"("scope", "scopeKey", "bucketDate");
CREATE INDEX "AnalyticsDailySnapshot_scope_bucketDate_idx" ON "AnalyticsDailySnapshot"("scope", "bucketDate");
CREATE INDEX "AnalyticsDailySnapshot_companyId_bucketDate_idx" ON "AnalyticsDailySnapshot"("companyId", "bucketDate");
CREATE INDEX "Company_status_createdAt_idx" ON "Company"("status", "createdAt");

ALTER TABLE "AnalyticsDailySnapshot"
ADD CONSTRAINT "AnalyticsDailySnapshot_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
