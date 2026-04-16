-- Deal risk scoring: add riskScore to Transaction
ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "riskScore" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Transaction_companyId_riskScore_idx"
ON "Transaction"("companyId", "riskScore");
