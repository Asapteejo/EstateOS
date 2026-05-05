CREATE TABLE "CommunicationTopUp" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "providerReference" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "creditsPurchased" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "ledgerEntryId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTopUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationTopUp_companyId_providerReference_key" ON "CommunicationTopUp"("companyId", "providerReference");
CREATE INDEX "CommunicationTopUp_companyId_status_createdAt_idx" ON "CommunicationTopUp"("companyId", "status", "createdAt");
CREATE INDEX "CommunicationTopUp_provider_providerReference_idx" ON "CommunicationTopUp"("provider", "providerReference");

ALTER TABLE "CommunicationTopUp" ADD CONSTRAINT "CommunicationTopUp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
