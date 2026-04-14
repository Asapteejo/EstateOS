import assert from "node:assert/strict";
import test from "node:test";

import { developmentCalculationSchema } from "@/lib/validations/development-calculations";

const baseInput = {
  projectName: "Test Project",
  location: "Lekki",
  notes: "",
  currency: "NGN",
  landSizeHectares: 10,
  landPurchasePrice: 100000000,
  purchaseDate: "",
  projectDurationMonths: 12,
  salesDurationMonths: 12,
  roadsPercentage: 15,
  drainagePercentage: 5,
  greenAreaPercentage: 5,
  utilitiesPercentage: 5,
  surveyCost: 0,
  legalDocumentationCost: 0,
  titlePerfectionCost: 0,
  siteClearingCost: 0,
  sandFillingEarthworkCost: 0,
  roadConstructionCost: 0,
  drainageCost: 0,
  powerInfrastructureCost: 0,
  waterInfrastructureCost: 0,
  fencingGatehouseSecurityCost: 0,
  marketingSalesCommissionCost: 0,
  adminCost: 0,
  contingencyCost: 0,
  annualInflationRate: 18,
  constructionCostEscalationRate: 12,
  annualSellingPriceAppreciationRate: 10,
  marketRiskPremiumRate: 5,
  financingCostRate: 0,
  requiredTargetProfitMarginRate: 25,
  saleMode: "PER_SQM",
  currentSellingPricePerSqm: 150000,
  paymentMode: "OUTRIGHT",
  installmentTenureMonths: undefined,
  installmentPremiumRate: undefined,
  useInflationAdjustedInstallmentPricing: false,
  salesMixItems: [],
  phases: [],
};

test("development calculation schema accepts a valid per-sqm payload", () => {
  const parsed = developmentCalculationSchema.safeParse(baseInput);
  assert.equal(parsed.success, true);
});

test("development calculation schema rejects sales mix above sellable area", () => {
  const parsed = developmentCalculationSchema.safeParse({
    ...baseInput,
    saleMode: "PER_PLOT",
    salesMixItems: [
      {
        label: "Oversized plots",
        quantity: 200,
        sizeSqm: 600,
        priceMode: "PER_UNIT",
        unitPrice: 12000000,
      },
    ],
  });

  assert.equal(parsed.success, false);
});

test("development calculation schema rejects reserved land at or above 100%", () => {
  const parsed = developmentCalculationSchema.safeParse({
    ...baseInput,
    roadsPercentage: 40,
    drainagePercentage: 20,
    greenAreaPercentage: 20,
    utilitiesPercentage: 20,
  });

  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error?.issues.some((issue) =>
      issue.message.includes("Reserved land must stay below 100%"),
    ),
  );
});

test("development calculation schema requires current selling price in per-sqm mode", () => {
  const parsed = developmentCalculationSchema.safeParse({
    ...baseInput,
    currentSellingPricePerSqm: undefined,
  });

  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error?.issues.some((issue) => issue.path.join(".") === "currentSellingPricePerSqm"),
  );
});

test("development calculation schema requires installment fields in installment mode", () => {
  const parsed = developmentCalculationSchema.safeParse({
    ...baseInput,
    paymentMode: "INSTALLMENT",
    installmentTenureMonths: undefined,
    installmentPremiumRate: undefined,
  });

  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error?.issues.some((issue) => issue.path.join(".") === "installmentTenureMonths"),
  );
  assert.ok(
    parsed.error?.issues.some((issue) => issue.path.join(".") === "installmentPremiumRate"),
  );
});

test("development calculation schema rejects phase shares above 100% in total", () => {
  const parsed = developmentCalculationSchema.safeParse({
    ...baseInput,
    phases: [
      {
        name: "Phase 1",
        startMonthOffset: 0,
        durationMonths: 6,
        developmentCostShare: 70,
        sellableInventoryShare: 60,
        salesVelocityRate: 80,
      },
      {
        name: "Phase 2",
        startMonthOffset: 6,
        durationMonths: 6,
        developmentCostShare: 40,
        sellableInventoryShare: 50,
        salesVelocityRate: 90,
      },
    ],
  });

  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error?.issues.some((issue) =>
      issue.message.includes("development cost shares cannot exceed 100%"),
    ),
  );
});
