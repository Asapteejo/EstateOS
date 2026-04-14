CREATE TYPE "DevelopmentSaleMode" AS ENUM ('PER_SQM', 'PER_PLOT', 'MIXED');

CREATE TYPE "DevelopmentPaymentMode" AS ENUM ('OUTRIGHT', 'INSTALLMENT');

CREATE TYPE "DevelopmentSalesMixPriceMode" AS ENUM ('PER_SQM', 'PER_UNIT');

CREATE TABLE "DevelopmentCalculation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "projectName" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "landSizeHectares" DECIMAL(12,4) NOT NULL,
    "landPurchasePrice" DECIMAL(14,2) NOT NULL,
    "purchaseDate" TIMESTAMP(3),
    "projectDurationMonths" INTEGER NOT NULL,
    "salesDurationMonths" INTEGER NOT NULL,
    "roadsPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "drainagePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "greenAreaPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "utilitiesPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "surveyCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "legalDocumentationCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "titlePerfectionCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "siteClearingCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sandFillingEarthworkCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "roadConstructionCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "drainageCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "powerInfrastructureCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "waterInfrastructureCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fencingGatehouseSecurityCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marketingSalesCommissionCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adminCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "contingencyCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "annualInflationRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "constructionCostEscalationRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "annualSellingPriceAppreciationRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "marketRiskPremiumRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "financingCostRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "requiredTargetProfitMarginRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "saleMode" "DevelopmentSaleMode" NOT NULL DEFAULT 'PER_SQM',
    "currentSellingPricePerSqm" DECIMAL(14,2),
    "paymentMode" "DevelopmentPaymentMode" NOT NULL DEFAULT 'OUTRIGHT',
    "installmentTenureMonths" INTEGER,
    "installmentPremiumRate" DECIMAL(5,2),
    "useInflationAdjustedInstallmentPricing" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevelopmentCalculation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DevelopmentCalculationSalesMixItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sizeSqm" DECIMAL(10,2) NOT NULL,
    "priceMode" "DevelopmentSalesMixPriceMode" NOT NULL DEFAULT 'PER_UNIT',
    "pricePerSqm" DECIMAL(14,2),
    "unitPrice" DECIMAL(14,2),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevelopmentCalculationSalesMixItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevelopmentCalculation_companyId_archivedAt_updatedAt_idx" ON "DevelopmentCalculation"("companyId", "archivedAt", "updatedAt");
CREATE INDEX "DevelopmentCalculation_companyId_projectName_idx" ON "DevelopmentCalculation"("companyId", "projectName");
CREATE INDEX "DevelopmentCalculationSalesMixItem_companyId_calculationId_idx" ON "DevelopmentCalculationSalesMixItem"("companyId", "calculationId");
CREATE INDEX "DevelopmentCalculationSalesMixItem_calculationId_displayOrder_idx" ON "DevelopmentCalculationSalesMixItem"("calculationId", "displayOrder");

ALTER TABLE "DevelopmentCalculation"
ADD CONSTRAINT "DevelopmentCalculation_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevelopmentCalculationSalesMixItem"
ADD CONSTRAINT "DevelopmentCalculationSalesMixItem_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevelopmentCalculationSalesMixItem"
ADD CONSTRAINT "DevelopmentCalculationSalesMixItem_calculationId_fkey"
FOREIGN KEY ("calculationId") REFERENCES "DevelopmentCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
