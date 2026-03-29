CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'GRANTED', 'EXPIRED', 'CANCELLED', 'PAST_DUE');
CREATE TYPE "BillingEventType" AS ENUM ('PLAN_ASSIGNED', 'PLAN_GRANTED', 'PLAN_REVOKED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_PAYMENT_RECORDED');
CREATE TYPE "CommissionType" AS ENUM ('FLAT', 'PERCENTAGE');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'READY', 'SUBMITTED', 'SETTLED', 'FAILED', 'NOT_APPLICABLE');
CREATE TYPE "ProviderAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');
CREATE TYPE "PaymentProviderCode" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'STRIPE', 'MANUAL');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING';

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interval" "BillingInterval" NOT NULL,
    "priceAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "canBeGranted" BOOLEAN NOT NULL DEFAULT true,
    "featureFlags" JSONB,
    "allowances" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanySubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "interval" "BillingInterval" NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "grantedByUserId" TEXT,
    "grantReason" TEXT,
    "externalSubscriptionId" TEXT,
    "externalCustomerId" TEXT,
    "billingProvider" "PaymentProviderCode",
    "autoRenews" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyPaymentProviderAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "PaymentProviderCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountReference" TEXT NOT NULL,
    "splitCode" TEXT,
    "subaccountCode" TEXT,
    "settlementCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "settlementCountry" TEXT,
    "status" "ProviderAccountStatus" NOT NULL DEFAULT 'PENDING',
    "supportsTransactionSplit" BOOLEAN NOT NULL DEFAULT false,
    "supportsSubscriptions" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultPayout" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPaymentProviderAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "planId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "feeType" "CommissionType" NOT NULL DEFAULT 'FLAT',
    "flatAmount" DECIMAL(12,2),
    "percentageRate" DECIMAL(5,2),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyBillingSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "transactionProvider" "PaymentProviderCode" NOT NULL DEFAULT 'PAYSTACK',
    "subscriptionProvider" "PaymentProviderCode",
    "requireActivePlanForTransactions" BOOLEAN NOT NULL DEFAULT true,
    "requireActivePlanForAdminOps" BOOLEAN NOT NULL DEFAULT false,
    "defaultCommissionRuleId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBillingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "transactionId" TEXT,
    "subscriptionId" TEXT,
    "planId" TEXT,
    "commissionRuleId" TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "companyAmount" DECIMAL(12,2) NOT NULL,
    "platformCommission" DECIMAL(12,2) NOT NULL,
    "providerFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SplitSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" "PaymentProviderCode" NOT NULL,
    "providerAccountId" TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "companyAmount" DECIMAL(12,2) NOT NULL,
    "platformAmount" DECIMAL(12,2) NOT NULL,
    "providerFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settlementReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "subscriptionId" TEXT,
    "actorUserId" TEXT,
    "type" "BillingEventType" NOT NULL,
    "provider" "PaymentProviderCode",
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "status" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");
CREATE UNIQUE INDEX "Plan_code_interval_key" ON "Plan"("code", "interval");
CREATE INDEX "Plan_isActive_isPublic_idx" ON "Plan"("isActive", "isPublic");

CREATE INDEX "CompanySubscription_companyId_isCurrent_status_idx" ON "CompanySubscription"("companyId", "isCurrent", "status");
CREATE INDEX "CompanySubscription_companyId_startsAt_endsAt_idx" ON "CompanySubscription"("companyId", "startsAt", "endsAt");
CREATE INDEX "CompanySubscription_planId_status_idx" ON "CompanySubscription"("planId", "status");

CREATE UNIQUE INDEX "CompanyPaymentProviderAccount_companyId_provider_accountReference_key" ON "CompanyPaymentProviderAccount"("companyId", "provider", "accountReference");
CREATE INDEX "CompanyPaymentProviderAccount_companyId_provider_status_idx" ON "CompanyPaymentProviderAccount"("companyId", "provider", "status");

CREATE UNIQUE INDEX "CommissionRule_companyId_code_key" ON "CommissionRule"("companyId", "code");
CREATE INDEX "CommissionRule_planId_isActive_idx" ON "CommissionRule"("planId", "isActive");
CREATE INDEX "CommissionRule_companyId_isActive_idx" ON "CommissionRule"("companyId", "isActive");

CREATE UNIQUE INDEX "CompanyBillingSettings_companyId_key" ON "CompanyBillingSettings"("companyId");
CREATE INDEX "CompanyBillingSettings_defaultCommissionRuleId_idx" ON "CompanyBillingSettings"("defaultCommissionRuleId");

CREATE UNIQUE INDEX "CommissionRecord_paymentId_key" ON "CommissionRecord"("paymentId");
CREATE INDEX "CommissionRecord_companyId_settlementStatus_createdAt_idx" ON "CommissionRecord"("companyId", "settlementStatus", "createdAt");
CREATE INDEX "CommissionRecord_companyId_subscriptionId_idx" ON "CommissionRecord"("companyId", "subscriptionId");
CREATE INDEX "CommissionRecord_companyId_transactionId_idx" ON "CommissionRecord"("companyId", "transactionId");

CREATE UNIQUE INDEX "SplitSettlement_paymentId_key" ON "SplitSettlement"("paymentId");
CREATE INDEX "SplitSettlement_companyId_provider_status_idx" ON "SplitSettlement"("companyId", "provider", "status");
CREATE INDEX "SplitSettlement_providerAccountId_idx" ON "SplitSettlement"("providerAccountId");

CREATE INDEX "BillingEvent_companyId_type_createdAt_idx" ON "BillingEvent"("companyId", "type", "createdAt");
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");

ALTER TABLE "CompanySubscription"
ADD CONSTRAINT "CompanySubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanySubscription"
ADD CONSTRAINT "CompanySubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanySubscription"
ADD CONSTRAINT "CompanySubscription_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyPaymentProviderAccount"
ADD CONSTRAINT "CompanyPaymentProviderAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommissionRule"
ADD CONSTRAINT "CommissionRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionRule"
ADD CONSTRAINT "CommissionRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyBillingSettings"
ADD CONSTRAINT "CompanyBillingSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyBillingSettings"
ADD CONSTRAINT "CompanyBillingSettings_defaultCommissionRuleId_fkey" FOREIGN KEY ("defaultCommissionRuleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommissionRecord"
ADD CONSTRAINT "CommissionRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord"
ADD CONSTRAINT "CommissionRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord"
ADD CONSTRAINT "CommissionRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord"
ADD CONSTRAINT "CommissionRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord"
ADD CONSTRAINT "CommissionRecord_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord"
ADD CONSTRAINT "CommissionRecord_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SplitSettlement"
ADD CONSTRAINT "SplitSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SplitSettlement"
ADD CONSTRAINT "SplitSettlement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SplitSettlement"
ADD CONSTRAINT "SplitSettlement_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "CompanyPaymentProviderAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
ADD CONSTRAINT "BillingEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingEvent"
ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingEvent"
ADD CONSTRAINT "BillingEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
