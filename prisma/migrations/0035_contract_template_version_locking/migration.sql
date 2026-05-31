CREATE TYPE "ContractTemplateMode" AS ENUM ('SYSTEM_TEMPLATE', 'UPLOADED_PDF_TEMPLATE');

CREATE TABLE "ContractTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "mode" "ContractTemplateMode" NOT NULL DEFAULT 'SYSTEM_TEMPLATE',
  "version" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "isConfigured" BOOLEAN NOT NULL DEFAULT false,
  "documentId" TEXT,
  "storageKey" TEXT,
  "fieldMappings" JSONB,
  "ceoName" TEXT NOT NULL,
  "ceoTitle" TEXT NOT NULL,
  "signatureKey" TEXT,
  "stampKey" TEXT,
  "contractTerms" TEXT,
  "footerLegalText" TEXT,
  "replacedByTemplateId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GeneratedContract"
ADD COLUMN "templateId" TEXT,
ADD COLUMN "templateVersion" INTEGER,
ADD COLUMN "templateMode" "ContractTemplateMode" NOT NULL DEFAULT 'SYSTEM_TEMPLATE',
ADD COLUMN "templateSnapshot" JSONB,
ADD COLUMN "regeneratedFromContractId" TEXT;

CREATE UNIQUE INDEX "ContractTemplate_companyId_version_key" ON "ContractTemplate"("companyId", "version");
CREATE INDEX "ContractTemplate_companyId_isActive_idx" ON "ContractTemplate"("companyId", "isActive");
CREATE INDEX "ContractTemplate_companyId_mode_isConfigured_idx" ON "ContractTemplate"("companyId", "mode", "isConfigured");
CREATE INDEX "ContractTemplate_companyId_archivedAt_idx" ON "ContractTemplate"("companyId", "archivedAt");
CREATE INDEX "GeneratedContract_companyId_templateId_idx" ON "GeneratedContract"("companyId", "templateId");
CREATE INDEX "GeneratedContract_companyId_regeneratedFromContractId_idx" ON "GeneratedContract"("companyId", "regeneratedFromContractId");

ALTER TABLE "ContractTemplate"
ADD CONSTRAINT "ContractTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ContractTemplate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ContractTemplate_replacedByTemplateId_fkey" FOREIGN KEY ("replacedByTemplateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ContractTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneratedContract"
ADD CONSTRAINT "GeneratedContract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedContract_regeneratedFromContractId_fkey" FOREIGN KEY ("regeneratedFromContractId") REFERENCES "GeneratedContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
