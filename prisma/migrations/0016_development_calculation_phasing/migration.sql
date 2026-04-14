-- Add phased planning support for development feasibility calculations.
CREATE TABLE "DevelopmentCalculationPhase" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "calculationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startMonthOffset" INTEGER NOT NULL DEFAULT 0,
  "durationMonths" INTEGER NOT NULL DEFAULT 1,
  "developmentCostShare" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "sellableInventoryShare" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "sellingPriceOverridePerSqm" DECIMAL(14,2),
  "sellingPriceUpliftRate" DECIMAL(6,2),
  "salesVelocityRate" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "notes" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DevelopmentCalculationPhase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevelopmentCalculationPhase_companyId_calculationId_idx"
ON "DevelopmentCalculationPhase"("companyId", "calculationId");

CREATE INDEX "DevelopmentCalculationPhase_calculationId_displayOrder_idx"
ON "DevelopmentCalculationPhase"("calculationId", "displayOrder");

ALTER TABLE "DevelopmentCalculationPhase"
ADD CONSTRAINT "DevelopmentCalculationPhase_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevelopmentCalculationPhase"
ADD CONSTRAINT "DevelopmentCalculationPhase_calculationId_fkey"
FOREIGN KEY ("calculationId") REFERENCES "DevelopmentCalculation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
