-- Phase 2 WhatsApp monetization: tenant communication wallet and credit ledger.
CREATE TYPE "CommunicationCreditLedgerType" AS ENUM ('TOP_UP', 'USAGE', 'ADJUSTMENT', 'REFUND');

CREATE TABLE "CompanyCommunicationWallet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "lowBalanceThreshold" INTEGER,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCommunicationWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationCreditLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CommunicationCreditLedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationCreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyCommunicationWallet_companyId_key" ON "CompanyCommunicationWallet"("companyId");
CREATE INDEX "CompanyCommunicationWallet_companyId_idx" ON "CompanyCommunicationWallet"("companyId");
CREATE INDEX "CommunicationCreditLedger_companyId_createdAt_idx" ON "CommunicationCreditLedger"("companyId", "createdAt");
CREATE INDEX "CommunicationCreditLedger_companyId_type_createdAt_idx" ON "CommunicationCreditLedger"("companyId", "type", "createdAt");
CREATE INDEX "CommunicationCreditLedger_reference_idx" ON "CommunicationCreditLedger"("reference");

ALTER TABLE "CompanyCommunicationWallet" ADD CONSTRAINT "CompanyCommunicationWallet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationCreditLedger" ADD CONSTRAINT "CommunicationCreditLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
