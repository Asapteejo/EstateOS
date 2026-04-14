import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDevelopmentFeasibility,
  createBlankDevelopmentCalculation,
} from "@/modules/development-calculations/engine";

test("development feasibility calculator derives sellable area, cost, and pricing outputs", () => {
  const input = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "Lekki Crest",
    landSizeHectares: 12,
    landPurchasePrice: 240000000,
    surveyCost: 4500000,
    legalDocumentationCost: 3000000,
    titlePerfectionCost: 6500000,
    siteClearingCost: 8500000,
    sandFillingEarthworkCost: 12000000,
    roadConstructionCost: 36000000,
    drainageCost: 18000000,
    powerInfrastructureCost: 9500000,
    waterInfrastructureCost: 6500000,
    fencingGatehouseSecurityCost: 14000000,
    marketingSalesCommissionCost: 11000000,
    adminCost: 5500000,
    contingencyCost: 8000000,
    currentSellingPricePerSqm: 185000,
  };

  const result = calculateDevelopmentFeasibility(input);

  assert.equal(result.area.grossSqm, 120000);
  assert.equal(result.area.sellableSqm, 84000);
  assert.ok(result.costs.adjustedTotalCost > result.costs.totalProjectCost);
  assert.ok(result.revenue.breakevenPricePerSqm > 0);
  assert.ok(result.revenue.minimumSellingPricePerSqm >= result.revenue.breakevenPricePerSqm);
  assert.equal(result.scenarios.length, 3);
});

test("development feasibility calculator handles mixed sales mode revenue", () => {
  const input = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "Epe Meadows",
    landPurchasePrice: 180000000,
    siteClearingCost: 9000000,
    roadConstructionCost: 24000000,
    saleMode: "MIXED" as const,
    paymentMode: "INSTALLMENT" as const,
    installmentTenureMonths: 18,
    installmentPremiumRate: 15,
    salesMixItems: [
      {
        id: "a",
        label: "300 sqm plot",
        quantity: 40,
        sizeSqm: 300,
        priceMode: "PER_UNIT" as const,
        unitPrice: 12000000,
      },
      {
        id: "b",
        label: "Corner plots",
        quantity: 8,
        sizeSqm: 450,
        priceMode: "PER_SQM" as const,
        pricePerSqm: 52000,
      },
    ],
  };

  const result = calculateDevelopmentFeasibility(input);

  assert.ok(result.salesMix.allocatedSqm > 0);
  assert.ok(result.revenue.estimatedRevenue > 0);
  assert.ok(result.pricing.installmentRecommendedPricePerSqm > result.pricing.outrightRecommendedPricePerSqm);
});

test("development feasibility calculator returns zero sellable outputs when deductions remove all land", () => {
  const input = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "No Sellable Area",
    roadsPercentage: 40,
    drainagePercentage: 20,
    greenAreaPercentage: 20,
    utilitiesPercentage: 20,
    currentSellingPricePerSqm: 250000,
  };

  const result = calculateDevelopmentFeasibility(input);

  assert.equal(result.area.sellableSqm, 0);
  assert.equal(result.revenue.breakevenPricePerSqm, 0);
  assert.equal(result.revenue.minimumSellingPricePerSqm, 0);
  assert.equal(result.revenue.profitPerSqm, 0);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("No sellable land remains after deductions"),
    ),
  );
});

test("development feasibility calculator keeps break-even and target price math explicit", () => {
  const input = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "Break-even Math Check",
    landSizeHectares: 2,
    landPurchasePrice: 1000000,
    currentSellingPricePerSqm: 1000,
    roadsPercentage: 10,
    drainagePercentage: 0,
    greenAreaPercentage: 0,
    utilitiesPercentage: 0,
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
    annualInflationRate: 0,
    constructionCostEscalationRate: 0,
    annualSellingPriceAppreciationRate: 0,
    marketRiskPremiumRate: 0,
    financingCostRate: 0,
    requiredTargetProfitMarginRate: 25,
  };

  const result = calculateDevelopmentFeasibility(input);

  assert.equal(result.area.sellableSqm, 18000);
  assert.equal(result.costs.adjustedTotalCost, 1000000);
  assert.equal(result.revenue.breakevenPricePerSqm, 55.56);
  assert.equal(result.revenue.minimumSellingPricePerSqm, 69.45);
});

test("development feasibility scenarios move in the expected direction around the base case", () => {
  const input = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "Scenario Spread",
    landPurchasePrice: 150000000,
    siteClearingCost: 5000000,
    roadConstructionCost: 18000000,
    drainageCost: 7000000,
    currentSellingPricePerSqm: 125000,
    annualInflationRate: 14,
    constructionCostEscalationRate: 10,
    annualSellingPriceAppreciationRate: 8,
  };

  const result = calculateDevelopmentFeasibility(input);
  const best = result.scenarios.find((scenario) => scenario.key === "BEST");
  const base = result.scenarios.find((scenario) => scenario.key === "BASE");
  const worst = result.scenarios.find((scenario) => scenario.key === "WORST");

  assert.ok(best);
  assert.ok(base);
  assert.ok(worst);
  assert.ok(best!.totalCost < base!.totalCost);
  assert.ok(worst!.totalCost > base!.totalCost);
  assert.ok(best!.estimatedRevenue > base!.estimatedRevenue);
  assert.ok(worst!.estimatedRevenue < base!.estimatedRevenue);
  assert.ok(best!.roiPercent > base!.roiPercent);
  assert.ok(worst!.roiPercent < base!.roiPercent);
});

test("development feasibility installment pricing applies premium and optional inflation uplift", () => {
  const baseInstallmentInput = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "Installment Pricing",
    landPurchasePrice: 80000000,
    siteClearingCost: 4000000,
    roadConstructionCost: 22000000,
    currentSellingPricePerSqm: 140000,
    paymentMode: "INSTALLMENT" as const,
    installmentTenureMonths: 18,
    installmentPremiumRate: 15,
    annualInflationRate: 12,
  };

  const withoutInflationUplift = calculateDevelopmentFeasibility({
    ...baseInstallmentInput,
    useInflationAdjustedInstallmentPricing: false,
  });
  const withInflationUplift = calculateDevelopmentFeasibility({
    ...baseInstallmentInput,
    useInflationAdjustedInstallmentPricing: true,
  });

  assert.ok(
    withoutInflationUplift.pricing.installmentRecommendedPricePerSqm >
      withoutInflationUplift.pricing.outrightRecommendedPricePerSqm,
  );
  assert.ok(
    withInflationUplift.pricing.installmentRecommendedPricePerSqm >
      withoutInflationUplift.pricing.installmentRecommendedPricePerSqm,
  );
  assert.ok(withInflationUplift.pricing.installmentPremiumRateApplied > 15);
});

test("development feasibility calculator builds phased cashflow and payback outputs", () => {
  const input = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "Phased Rollout",
    landPurchasePrice: 120000000,
    siteClearingCost: 6000000,
    roadConstructionCost: 26000000,
    drainageCost: 9000000,
    currentSellingPricePerSqm: 165000,
    phases: [
      {
        name: "Phase 1",
        startMonthOffset: 0,
        durationMonths: 6,
        developmentCostShare: 55,
        sellableInventoryShare: 45,
        salesVelocityRate: 85,
        sellingPriceUpliftRate: 0,
        notes: "",
      },
      {
        name: "Phase 2",
        startMonthOffset: 6,
        durationMonths: 8,
        developmentCostShare: 45,
        sellableInventoryShare: 55,
        salesVelocityRate: 70,
        sellingPriceUpliftRate: 8,
        notes: "",
      },
    ],
  };

  const result = calculateDevelopmentFeasibility(input);

  assert.equal(result.phasing.hasCustomPhases, true);
  assert.equal(result.phasing.phases.length, 2);
  assert.ok(result.phasing.monthlyForecast.length >= 8);
  assert.ok(result.phasing.peakFundingGap >= 0);
  assert.ok(result.phasing.revenueByPhase > 0);
  assert.ok(result.phasing.costByPhase > 0);
});

test("development feasibility calculator falls back to a default whole-project phase", () => {
  const input = {
    ...createBlankDevelopmentCalculation("NGN"),
    projectName: "Default Phase",
    landPurchasePrice: 90000000,
    currentSellingPricePerSqm: 140000,
    phases: [],
  };

  const result = calculateDevelopmentFeasibility(input);

  assert.equal(result.phasing.hasCustomPhases, false);
  assert.equal(result.phasing.phases.length, 1);
  assert.equal(result.phasing.phases[0]?.name, "Whole project");
});
