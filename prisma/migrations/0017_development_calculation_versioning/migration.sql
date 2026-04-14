ALTER TABLE "DevelopmentCalculation"
ADD COLUMN "versionGroupId" TEXT,
ADD COLUMN "versionNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "versionLabel" TEXT,
ADD COLUMN "sourcePresetKey" TEXT;

CREATE INDEX "DevelopmentCalculation_companyId_versionGroupId_archivedAt_u_idx"
ON "DevelopmentCalculation"("companyId", "versionGroupId", "archivedAt", "updatedAt");
