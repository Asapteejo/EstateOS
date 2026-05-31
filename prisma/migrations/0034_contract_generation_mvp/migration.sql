CREATE TYPE "GeneratedContractStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'VOIDED', 'REGENERATED');

CREATE TABLE "CompanyContractSettings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ceoName" TEXT NOT NULL,
  "ceoTitle" TEXT NOT NULL,
  "signatureKey" TEXT,
  "stampKey" TEXT,
  "contractTerms" TEXT,
  "footerLegalText" TEXT,
  "isConfigured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyContractSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedContract" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "buyerUserId" TEXT NOT NULL,
  "propertyId" TEXT,
  "transactionId" TEXT,
  "paymentRequestId" TEXT,
  "paymentId" TEXT,
  "documentId" TEXT NOT NULL,
  "contractNumber" TEXT NOT NULL,
  "status" "GeneratedContractStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GeneratedContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyContractSettings_companyId_key" ON "CompanyContractSettings"("companyId");
CREATE INDEX "CompanyContractSettings_companyId_isConfigured_idx" ON "CompanyContractSettings"("companyId", "isConfigured");

CREATE UNIQUE INDEX "GeneratedContract_documentId_key" ON "GeneratedContract"("documentId");
CREATE UNIQUE INDEX "GeneratedContract_contractNumber_key" ON "GeneratedContract"("contractNumber");
CREATE INDEX "GeneratedContract_companyId_buyerUserId_status_idx" ON "GeneratedContract"("companyId", "buyerUserId", "status");
CREATE INDEX "GeneratedContract_companyId_transactionId_status_idx" ON "GeneratedContract"("companyId", "transactionId", "status");
CREATE INDEX "GeneratedContract_companyId_paymentId_idx" ON "GeneratedContract"("companyId", "paymentId");
CREATE INDEX "GeneratedContract_companyId_propertyId_idx" ON "GeneratedContract"("companyId", "propertyId");

ALTER TABLE "CompanyContractSettings"
ADD CONSTRAINT "CompanyContractSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedContract"
ADD CONSTRAINT "GeneratedContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
