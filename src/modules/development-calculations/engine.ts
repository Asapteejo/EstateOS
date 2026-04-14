import type {
  DevelopmentCalculationInput,
  DevelopmentCalculationPhaseInput,
  DevelopmentSalesMixItemInput,
} from "@/lib/validations/development-calculations";

export type DevelopmentCalculationScenarioKey = "BEST" | "BASE" | "WORST";

export type DevelopmentCalculationScenarioResult = {
  key: DevelopmentCalculationScenarioKey;
  label: string;
  summary: string;
  totalCost: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  roiPercent: number;
  marginPercent: number;
  minimumSellingPricePerSqm: number;
};

export type DevelopmentCalculationResult = {
  inputs: DevelopmentCalculationInput;
  area: {
    grossSqm: number;
    reservedPercentage: number;
    reservedSqm: number;
    sellableSqm: number;
    sellableHectares: number;
  };
  costs: {
    landAcquisitionCost: number;
    totalDevelopmentCost: number;
    totalOperatingCost: number;
    riskProvisionCost: number;
    financingCost: number;
    totalProjectCost: number;
    inflationAdjustedOperatingCost: number;
    escalatedDevelopmentCost: number;
    adjustedTotalCost: number;
    costPerSellableSqm: number;
  };
  revenue: {
    pricingBasis: "INPUT" | "RECOMMENDED_MINIMUM";
    effectiveSellingPricePerSqm: number;
    estimatedRevenue: number;
    estimatedGrossProfit: number;
    roiPercent: number;
    marginPercent: number;
    profitPerSqm: number;
    breakevenPricePerSqm: number;
    minimumSellingPricePerSqm: number;
  };
  pricing: {
    outrightRecommendedPricePerSqm: number;
    installmentRecommendedPricePerSqm: number;
    outrightRecommendedRevenue: number;
    installmentRecommendedRevenue: number;
    installmentPremiumRateApplied: number;
  };
  salesMix: {
    allocatedSqm: number;
    allocatedPercentOfSellable: number;
    items: Array<{
      label: string;
      quantity: number;
      sizeSqm: number;
      totalAreaSqm: number;
      effectiveUnitPrice: number;
      effectivePricePerSqm: number;
      estimatedRevenue: number;
    }>;
  };
  phasing: {
    hasCustomPhases: boolean;
    totalDevelopmentCostShare: number;
    totalSellableInventoryShare: number;
    realizedSellThroughShare: number;
    revenueByPhase: number;
    costByPhase: number;
    realizedProfit: number;
    realizedMarginPercent: number;
    peakFundingGap: number;
    cumulativeCashLowPoint: number;
    paybackMonth: number | null;
    paybackPhase: string | null;
    phases: Array<{
      name: string;
      startMonthOffset: number;
      durationMonths: number;
      endMonthOffset: number;
      developmentCostShare: number;
      sellableInventoryShare: number;
      salesVelocityRate: number;
      allocatedSellableSqm: number;
      realizedSellableSqm: number;
      phasePricePerSqm: number;
      phaseRevenue: number;
      phaseDevelopmentCost: number;
      phaseOperatingCost: number;
      phaseRiskCost: number;
      phaseFinancingCost: number;
      phaseOutflow: number;
      phaseInflow: number;
      phaseNetCash: number;
      cumulativeCash: number;
      marginPercent: number;
      notes?: string;
    }>;
    monthlyForecast: Array<{
      month: number;
      label: string;
      outflow: number;
      inflow: number;
      netCash: number;
      cumulativeCash: number;
    }>;
    timingWarnings: string[];
  };
  scenarios: DevelopmentCalculationScenarioResult[];
  warnings: string[];
};

type ScenarioOverride = {
  key: DevelopmentCalculationScenarioKey;
  label: string;
  summary: string;
  costMultiplier: number;
  priceMultiplier: number;
  projectDurationDeltaMonths: number;
  salesDurationDeltaMonths: number;
  annualInflationDelta: number;
  constructionEscalationDelta: number;
  annualSellingPriceAppreciationDelta: number;
};

const HECTARE_TO_SQM = 10_000;
const STANDARD_PLOT_SQM = 500;

const SCENARIOS: ScenarioOverride[] = [
  {
    key: "BEST",
    label: "Best case",
    summary: "Lower delivery cost pressure with stronger pricing and faster sell-through.",
    costMultiplier: 0.96,
    priceMultiplier: 1.08,
    projectDurationDeltaMonths: -2,
    salesDurationDeltaMonths: -2,
    annualInflationDelta: -2,
    constructionEscalationDelta: -2,
    annualSellingPriceAppreciationDelta: 2,
  },
  {
    key: "BASE",
    label: "Base case",
    summary: "Uses the assumptions entered by the operator as the planning baseline.",
    costMultiplier: 1,
    priceMultiplier: 1,
    projectDurationDeltaMonths: 0,
    salesDurationDeltaMonths: 0,
    annualInflationDelta: 0,
    constructionEscalationDelta: 0,
    annualSellingPriceAppreciationDelta: 0,
  },
  {
    key: "WORST",
    label: "Worst case",
    summary: "Higher cost pressure, slower execution, and softer pricing against collections risk.",
    costMultiplier: 1.12,
    priceMultiplier: 0.9,
    projectDurationDeltaMonths: 4,
    salesDurationDeltaMonths: 4,
    annualInflationDelta: 3,
    constructionEscalationDelta: 4,
    annualSellingPriceAppreciationDelta: -3,
  },
];

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function safeDivide(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function percentageToDecimal(input: number) {
  return input / 100;
}

function sumCostFields(input: number[]) {
  return roundTo(input.reduce((sum, value) => sum + value, 0));
}

function sanitizeMixItemPrice(item: DevelopmentSalesMixItemInput) {
  if (item.priceMode === "PER_SQM") {
    return {
      unitPrice: roundTo(item.sizeSqm * (item.pricePerSqm ?? 0)),
      pricePerSqm: roundTo(item.pricePerSqm ?? 0),
    };
  }

  return {
    unitPrice: roundTo(item.unitPrice ?? 0),
    pricePerSqm: roundTo(safeDivide(item.unitPrice ?? 0, item.sizeSqm)),
  };
}

type NormalizedPhasePlanItem = DevelopmentCalculationPhaseInput & {
  name: string;
  notes?: string;
};

function getDefaultPhasePlan(input: DevelopmentCalculationInput): NormalizedPhasePlanItem[] {
  return [
    {
      id: "default-phase-1",
      name: "Whole project",
      startMonthOffset: 0,
      durationMonths: Math.max(input.projectDurationMonths, input.salesDurationMonths, 1),
      developmentCostShare: 100,
      sellableInventoryShare: 100,
      salesVelocityRate: 100,
      notes: "Default timing plan derived from the saved feasibility assumptions.",
    },
  ];
}

function normalizePhasePlan(input: DevelopmentCalculationInput) {
  const phases =
    input.phases.length > 0
      ? input.phases.map((phase, index) => ({
          ...phase,
          name: phase.name || `Phase ${index + 1}`,
          notes: phase.notes || undefined,
        }))
      : getDefaultPhasePlan(input);

  return phases.sort((left, right) => left.startMonthOffset - right.startMonthOffset);
}

function applyTrailingRemainder(
  rawShares: number[],
  totalTarget = 100,
) {
  const applied = rawShares.map((value) => roundTo(Math.max(value, 0), 4));
  const currentTotal = roundTo(applied.reduce((sum, value) => sum + value, 0), 4);

  if (applied.length === 0) {
    return applied;
  }

  const remainder = roundTo(totalTarget - currentTotal, 4);
  applied[applied.length - 1] = roundTo(Math.max(applied[applied.length - 1] + remainder, 0), 4);

  return applied;
}

function formatMonthLabel(month: number) {
  return `M${month + 1}`;
}

function buildPhasingResult(params: {
  input: DevelopmentCalculationInput;
  sellableSqm: number;
  landAcquisitionCost: number;
  totalDevelopmentCost: number;
  totalOperatingCost: number;
  riskProvisionCost: number;
  financingCost: number;
  effectiveSellingPricePerSqm: number;
}) {
  const {
    input,
    sellableSqm,
    landAcquisitionCost,
    totalDevelopmentCost,
    totalOperatingCost,
    riskProvisionCost,
    financingCost,
    effectiveSellingPricePerSqm,
  } = params;
  const normalizedPhases = normalizePhasePlan(input);
  const customPhases = input.phases.length > 0;
  const totalDevelopmentCostShare = roundTo(
    normalizedPhases.reduce((sum, phase) => sum + phase.developmentCostShare, 0),
  );
  const totalSellableInventoryShare = roundTo(
    normalizedPhases.reduce((sum, phase) => sum + phase.sellableInventoryShare, 0),
  );
  const appliedDevelopmentShares = applyTrailingRemainder(
    normalizedPhases.map((phase) => phase.developmentCostShare),
  );
  const appliedInventoryShares = applyTrailingRemainder(
    normalizedPhases.map((phase) => phase.sellableInventoryShare),
  );
  const realizedVelocityWeights = normalizedPhases.map((phase, index) =>
    roundTo((appliedInventoryShares[index] / 100) * percentageToDecimal(phase.salesVelocityRate), 6),
  );
  const appliedVelocityWeights =
    realizedVelocityWeights.some((weight) => weight > 0)
      ? realizedVelocityWeights
      : normalizedPhases.map((_, index) => (index === normalizedPhases.length - 1 ? 1 : 0));
  const totalVelocityWeight = appliedVelocityWeights.reduce((sum, value) => sum + value, 0) || 1;
  const projectCostWithoutLand = roundTo(
    totalDevelopmentCost + totalOperatingCost + riskProvisionCost + financingCost,
  );
  const monthlyMap = new Map<number, { outflow: number; inflow: number }>();
  const timingWarnings: string[] = [];

  if (customPhases && totalDevelopmentCostShare < 100) {
    timingWarnings.push(
      "Phase development cost shares do not cover the full project, so the remaining delivery cost has been pushed into the final phase for the forecast.",
    );
  }

  if (customPhases && totalSellableInventoryShare < 100) {
    timingWarnings.push(
      "Phase inventory shares do not cover the full sellable estate, so the remaining revenue potential has been assigned to the final phase for timing analysis.",
    );
  }

  let cumulativeCash = 0;
  let cumulativeCashLowPoint = 0;
  let paybackMonth: number | null = null;
  let paybackPhase: string | null = null;

  const phases = normalizedPhases.map((phase, index) => {
    const phaseMidpointYears = (phase.startMonthOffset + phase.durationMonths / 2) / 12;
    const developmentShareRatio = appliedDevelopmentShares[index] / 100;
    const inventoryShareRatio = appliedInventoryShares[index] / 100;
    const realizedVelocityRatio = safeDivide(appliedVelocityWeights[index], totalVelocityWeight);
    const developmentEscalationMultiplier = Math.pow(
      1 + percentageToDecimal(input.constructionCostEscalationRate),
      phaseMidpointYears,
    );
    const operatingInflationMultiplier = Math.pow(
      1 + percentageToDecimal(input.annualInflationRate),
      phaseMidpointYears,
    );
    const sellingPriceGrowthMultiplier = Math.pow(
      1 + percentageToDecimal(input.annualSellingPriceAppreciationRate),
      phaseMidpointYears,
    );
    const basePhasePricePerSqm = phase.sellingPriceOverridePerSqm
      ? phase.sellingPriceOverridePerSqm
      : effectiveSellingPricePerSqm * sellingPriceGrowthMultiplier;
    const phasePricePerSqm = roundTo(
      basePhasePricePerSqm *
        (1 +
          percentageToDecimal(phase.sellingPriceUpliftRate ?? 0)),
    );
    const allocatedSellableSqm = roundTo(sellableSqm * inventoryShareRatio);
    const realizedSellableSqm = roundTo(
      allocatedSellableSqm * percentageToDecimal(phase.salesVelocityRate),
    );
    const phaseDevelopmentCost = roundTo(
      totalDevelopmentCost * developmentShareRatio * developmentEscalationMultiplier,
    );
    const phaseOperatingCost = roundTo(
      totalOperatingCost * realizedVelocityRatio * operatingInflationMultiplier,
    );
    const phaseRiskCost = roundTo(riskProvisionCost * developmentShareRatio);
    const phaseFinancingCost = roundTo(financingCost * developmentShareRatio);
    const phaseOutflow = roundTo(
      phaseDevelopmentCost + phaseOperatingCost + phaseRiskCost + phaseFinancingCost,
    );
    const phaseInflow = roundTo(realizedSellableSqm * phasePricePerSqm);
    const phaseNetCash = roundTo(phaseInflow - phaseOutflow);
    cumulativeCash = roundTo(cumulativeCash + phaseNetCash);
    cumulativeCashLowPoint = Math.min(cumulativeCashLowPoint, cumulativeCash);

    if (paybackMonth == null && cumulativeCash >= 0 && phaseInflow > 0) {
      paybackMonth = phase.startMonthOffset + phase.durationMonths;
      paybackPhase = phase.name;
    }

    const monthSpan = Math.max(phase.durationMonths, 1);
    const monthlyOutflow = roundTo(phaseOutflow / monthSpan, 4);
    const monthlyInflow = roundTo(phaseInflow / monthSpan, 4);

    for (let monthIndex = 0; monthIndex < monthSpan; monthIndex += 1) {
      const month = phase.startMonthOffset + monthIndex;
      const existing = monthlyMap.get(month) ?? { outflow: 0, inflow: 0 };
      monthlyMap.set(month, {
        outflow: roundTo(existing.outflow + monthlyOutflow, 4),
        inflow: roundTo(existing.inflow + monthlyInflow, 4),
      });
    }

    return {
      name: phase.name,
      startMonthOffset: phase.startMonthOffset,
      durationMonths: phase.durationMonths,
      endMonthOffset: phase.startMonthOffset + phase.durationMonths,
      developmentCostShare: roundTo(appliedDevelopmentShares[index], 2),
      sellableInventoryShare: roundTo(appliedInventoryShares[index], 2),
      salesVelocityRate: phase.salesVelocityRate,
      allocatedSellableSqm,
      realizedSellableSqm,
      phasePricePerSqm,
      phaseRevenue: phaseInflow,
      phaseDevelopmentCost,
      phaseOperatingCost,
      phaseRiskCost,
      phaseFinancingCost,
      phaseOutflow,
      phaseInflow,
      phaseNetCash,
      cumulativeCash,
      marginPercent: roundTo(safeDivide(phaseInflow - phaseOutflow, phaseInflow) * 100),
      notes: phase.notes,
    };
  });

  const firstMonth = Math.min(0, ...Array.from(monthlyMap.keys()));
  const lastMonth = Math.max(0, ...Array.from(monthlyMap.keys()));
  let rollingCash = roundTo(-landAcquisitionCost);
  let peakFundingGap = Math.max(-rollingCash, 0);
  const monthlyForecast = [];

  for (let month = firstMonth; month <= lastMonth; month += 1) {
    const baseEntry = monthlyMap.get(month) ?? { outflow: 0, inflow: 0 };
    const outflow = roundTo(baseEntry.outflow + (month === 0 ? landAcquisitionCost : 0));
    const inflow = roundTo(baseEntry.inflow);
    const netCash = roundTo(inflow - outflow);
    rollingCash = roundTo(rollingCash + netCash);
    peakFundingGap = Math.max(peakFundingGap, Math.max(-rollingCash, 0));

    if (paybackMonth == null && rollingCash >= 0 && inflow > 0) {
      paybackMonth = month + 1;
      const phase = phases.find(
        (item) => month >= item.startMonthOffset && month < item.endMonthOffset,
      );
      paybackPhase = phase?.name ?? null;
    }

    monthlyForecast.push({
      month,
      label: formatMonthLabel(month),
      outflow,
      inflow,
      netCash,
      cumulativeCash: rollingCash,
    });
  }

  const revenueByPhase = roundTo(phases.reduce((sum, phase) => sum + phase.phaseRevenue, 0));
  const costByPhase = roundTo(landAcquisitionCost + phases.reduce((sum, phase) => sum + phase.phaseOutflow, 0));
  const realizedProfit = roundTo(revenueByPhase - costByPhase);
  const realizedMarginPercent = roundTo(safeDivide(realizedProfit, revenueByPhase) * 100);
  const realizedSellThroughShare = roundTo(
    safeDivide(
      phases.reduce((sum, phase) => sum + phase.realizedSellableSqm, 0),
      sellableSqm,
    ) * 100,
  );

  if (peakFundingGap > projectCostWithoutLand * 0.25) {
    timingWarnings.push(
      "Phase timing creates a material funding gap before sales recover the outflow. Review phase spacing, pricing cadence, or financing cover.",
    );
  }

  if (paybackMonth == null) {
    timingWarnings.push(
      "The phased forecast does not recover cumulative cash within the current plan window.",
    );
  }

  if (revenueByPhase < costByPhase) {
    timingWarnings.push(
      "Phase timing turns the project cashflow negative even though the static feasibility may still look viable. Recheck sell-through and release timing.",
    );
  }

  return {
    hasCustomPhases: customPhases,
    totalDevelopmentCostShare,
    totalSellableInventoryShare,
    realizedSellThroughShare,
    revenueByPhase,
    costByPhase,
    realizedProfit,
    realizedMarginPercent,
    peakFundingGap: roundTo(peakFundingGap),
    cumulativeCashLowPoint: roundTo(cumulativeCashLowPoint),
    paybackMonth,
    paybackPhase,
    phases,
    monthlyForecast,
    timingWarnings,
  };
}

/**
 * Central feasibility engine for the land development calculator.
 *
 * The formulas intentionally stay explicit and inspectable:
 * 1. convert hectares -> sqm
 * 2. remove reserved land allocations
 * 3. separate acquisition, development, and operating cost pools
 * 4. apply inflation + construction escalation across project duration
 * 5. add risk and financing provisions
 * 6. derive cost-per-sellable-sqm, breakeven, revenue, profit, ROI, and scenarios
 */
export function calculateDevelopmentFeasibility(
  input: DevelopmentCalculationInput,
): DevelopmentCalculationResult {
  const grossSqm = roundTo(input.landSizeHectares * HECTARE_TO_SQM, 2);
  const reservedPercentage = roundTo(
    input.roadsPercentage +
      input.drainagePercentage +
      input.greenAreaPercentage +
      input.utilitiesPercentage,
  );
  const reservedSqm = roundTo(grossSqm * percentageToDecimal(reservedPercentage), 2);
  const sellableSqm = roundTo(Math.max(grossSqm - reservedSqm, 0), 2);
  const sellableHectares = roundTo(sellableSqm / HECTARE_TO_SQM, 4);

  const landAcquisitionCost = sumCostFields([
    input.landPurchasePrice,
    input.surveyCost,
    input.legalDocumentationCost,
    input.titlePerfectionCost,
  ]);
  const totalDevelopmentCost = sumCostFields([
    input.siteClearingCost,
    input.sandFillingEarthworkCost,
    input.roadConstructionCost,
    input.drainageCost,
    input.powerInfrastructureCost,
    input.waterInfrastructureCost,
    input.fencingGatehouseSecurityCost,
  ]);
  const totalOperatingCost = sumCostFields([
    input.marketingSalesCommissionCost,
    input.adminCost,
    input.contingencyCost,
  ]);
  const totalProjectCost = roundTo(
    landAcquisitionCost + totalDevelopmentCost + totalOperatingCost,
  );

  const projectYears = input.projectDurationMonths / 12;
  const salesYears = input.salesDurationMonths / 12;
  const inflationMultiplier = Math.pow(
    1 + percentageToDecimal(input.annualInflationRate),
    projectYears,
  );
  const escalationMultiplier = Math.pow(
    1 + percentageToDecimal(input.constructionCostEscalationRate),
    projectYears,
  );
  const salesAppreciationMultiplier = Math.pow(
    1 + percentageToDecimal(input.annualSellingPriceAppreciationRate),
    salesYears,
  );
  const inflationAdjustedOperatingCost = roundTo(totalOperatingCost * inflationMultiplier);
  const escalatedDevelopmentCost = roundTo(totalDevelopmentCost * escalationMultiplier);
  const riskProvisionCost = roundTo(
    (landAcquisitionCost + escalatedDevelopmentCost + inflationAdjustedOperatingCost) *
      percentageToDecimal(input.marketRiskPremiumRate),
  );
  const financingCost = roundTo(
    (landAcquisitionCost + escalatedDevelopmentCost + inflationAdjustedOperatingCost) *
      percentageToDecimal(input.financingCostRate) *
      projectYears,
  );
  const adjustedTotalCost = roundTo(
    landAcquisitionCost +
      escalatedDevelopmentCost +
      inflationAdjustedOperatingCost +
      riskProvisionCost +
      financingCost,
  );

  const breakevenPricePerSqm = roundTo(safeDivide(adjustedTotalCost, sellableSqm));
  const minimumSellingPricePerSqm = roundTo(
    breakevenPricePerSqm * (1 + percentageToDecimal(input.requiredTargetProfitMarginRate)),
  );

  const normalizedSalesItems = input.salesMixItems.map((item) => {
    const basePrice = sanitizeMixItemPrice(item);
    const effectiveUnitPrice = roundTo(basePrice.unitPrice * salesAppreciationMultiplier);
    const effectivePricePerSqm = roundTo(basePrice.pricePerSqm * salesAppreciationMultiplier);
    const totalAreaSqm = roundTo(item.sizeSqm * item.quantity, 2);
    const estimatedRevenue = roundTo(effectiveUnitPrice * item.quantity);

    return {
      label: item.label,
      quantity: item.quantity,
      sizeSqm: item.sizeSqm,
      totalAreaSqm,
      effectiveUnitPrice,
      effectivePricePerSqm,
      estimatedRevenue,
    };
  });

  const allocatedSqm = roundTo(
    normalizedSalesItems.reduce((sum, item) => sum + item.totalAreaSqm, 0),
    2,
  );
  const effectiveSellingPricePerSqm =
    input.saleMode === "PER_SQM"
      ? roundTo(
          (input.currentSellingPricePerSqm ?? minimumSellingPricePerSqm) *
            salesAppreciationMultiplier,
        )
      : roundTo(
          safeDivide(
            normalizedSalesItems.reduce((sum, item) => sum + item.estimatedRevenue, 0),
            allocatedSqm,
          ),
        );

  const estimatedRevenue =
    input.saleMode === "PER_SQM"
      ? roundTo(sellableSqm * effectiveSellingPricePerSqm)
      : roundTo(normalizedSalesItems.reduce((sum, item) => sum + item.estimatedRevenue, 0));

  const estimatedGrossProfit = roundTo(estimatedRevenue - adjustedTotalCost);
  const roiPercent = roundTo(safeDivide(estimatedGrossProfit, adjustedTotalCost) * 100);
  const marginPercent = roundTo(safeDivide(estimatedGrossProfit, estimatedRevenue) * 100);
  const profitPerSqm = roundTo(safeDivide(estimatedGrossProfit, sellableSqm));

  const installmentPremiumRateApplied =
    input.paymentMode === "INSTALLMENT" ? input.installmentPremiumRate ?? 0 : 0;
  const installmentInflationPremium =
    input.paymentMode === "INSTALLMENT" &&
    input.useInflationAdjustedInstallmentPricing &&
    input.installmentTenureMonths
      ? percentageToDecimal(input.annualInflationRate) * (input.installmentTenureMonths / 12)
      : 0;
  const installmentRecommendedPricePerSqm = roundTo(
    minimumSellingPricePerSqm *
      (1 +
        percentageToDecimal(installmentPremiumRateApplied) +
        installmentInflationPremium),
  );
  const outrightRecommendedPricePerSqm = roundTo(minimumSellingPricePerSqm);
  const outrightRecommendedRevenue = roundTo(outrightRecommendedPricePerSqm * sellableSqm);
  const installmentRecommendedRevenue = roundTo(
    installmentRecommendedPricePerSqm * sellableSqm,
  );
  const phasing = buildPhasingResult({
    input,
    sellableSqm,
    landAcquisitionCost,
    totalDevelopmentCost,
    totalOperatingCost,
    riskProvisionCost,
    financingCost,
    effectiveSellingPricePerSqm,
  });

  const warnings: string[] = [];

  if (reservedPercentage >= 45) {
    warnings.push(
      "Reserved land is consuming a large share of the site. Recheck roads, utilities, and common-use allocations.",
    );
  }

  if (sellableSqm <= 0) {
    warnings.push("No sellable land remains after deductions. Adjust land utilization assumptions.");
  }

  if (
    input.saleMode !== "PER_SQM" &&
    allocatedSqm > 0 &&
    allocatedSqm < sellableSqm * 0.7
  ) {
    warnings.push(
      "The current sales mix allocates far less land than the sellable area. Revenue may be understated.",
    );
  }

  if (input.saleMode === "PER_SQM" && effectiveSellingPricePerSqm < breakevenPricePerSqm) {
    warnings.push("Current selling price is below break-even for the current cost assumptions.");
  }

  if (input.requiredTargetProfitMarginRate >= 40) {
    warnings.push(
      "Target margin is aggressive. Check whether local market pricing can absorb it without slowing sales.",
    );
  }

  warnings.push(...phasing.timingWarnings);

  const scenarios = SCENARIOS.map((scenario) => {
    const scenarioInput: DevelopmentCalculationInput = {
      ...input,
      projectDurationMonths: Math.max(1, input.projectDurationMonths + scenario.projectDurationDeltaMonths),
      salesDurationMonths: Math.max(1, input.salesDurationMonths + scenario.salesDurationDeltaMonths),
      annualInflationRate: Math.max(0, input.annualInflationRate + scenario.annualInflationDelta),
      constructionCostEscalationRate: Math.max(
        0,
        input.constructionCostEscalationRate + scenario.constructionEscalationDelta,
      ),
      annualSellingPriceAppreciationRate: Math.max(
        0,
        input.annualSellingPriceAppreciationRate + scenario.annualSellingPriceAppreciationDelta,
      ),
      landPurchasePrice: roundTo(input.landPurchasePrice * scenario.costMultiplier),
      surveyCost: roundTo(input.surveyCost * scenario.costMultiplier),
      legalDocumentationCost: roundTo(input.legalDocumentationCost * scenario.costMultiplier),
      titlePerfectionCost: roundTo(input.titlePerfectionCost * scenario.costMultiplier),
      siteClearingCost: roundTo(input.siteClearingCost * scenario.costMultiplier),
      sandFillingEarthworkCost: roundTo(input.sandFillingEarthworkCost * scenario.costMultiplier),
      roadConstructionCost: roundTo(input.roadConstructionCost * scenario.costMultiplier),
      drainageCost: roundTo(input.drainageCost * scenario.costMultiplier),
      powerInfrastructureCost: roundTo(input.powerInfrastructureCost * scenario.costMultiplier),
      waterInfrastructureCost: roundTo(input.waterInfrastructureCost * scenario.costMultiplier),
      fencingGatehouseSecurityCost: roundTo(
        input.fencingGatehouseSecurityCost * scenario.costMultiplier,
      ),
      marketingSalesCommissionCost: roundTo(
        input.marketingSalesCommissionCost * scenario.costMultiplier,
      ),
      adminCost: roundTo(input.adminCost * scenario.costMultiplier),
      contingencyCost: roundTo(input.contingencyCost * scenario.costMultiplier),
      currentSellingPricePerSqm: input.currentSellingPricePerSqm
        ? roundTo(input.currentSellingPricePerSqm * scenario.priceMultiplier)
        : input.currentSellingPricePerSqm,
      salesMixItems: input.salesMixItems.map((item) => ({
        ...item,
        pricePerSqm: item.pricePerSqm
          ? roundTo(item.pricePerSqm * scenario.priceMultiplier)
          : item.pricePerSqm,
        unitPrice: item.unitPrice
          ? roundTo(item.unitPrice * scenario.priceMultiplier)
          : item.unitPrice,
      })),
    };

    const result = calculateDevelopmentFeasibilityBaseOnly(scenarioInput);

    return {
      key: scenario.key,
      label: scenario.label,
      summary: scenario.summary,
      totalCost: result.adjustedTotalCost,
      estimatedRevenue: result.estimatedRevenue,
      estimatedProfit: result.estimatedGrossProfit,
      roiPercent: result.roiPercent,
      marginPercent: result.marginPercent,
      minimumSellingPricePerSqm: result.minimumSellingPricePerSqm,
    };
  });

  return {
    inputs: input,
    area: {
      grossSqm,
      reservedPercentage,
      reservedSqm,
      sellableSqm,
      sellableHectares,
    },
    costs: {
      landAcquisitionCost,
      totalDevelopmentCost,
      totalOperatingCost,
      riskProvisionCost,
      financingCost,
      totalProjectCost,
      inflationAdjustedOperatingCost,
      escalatedDevelopmentCost,
      adjustedTotalCost,
      costPerSellableSqm: breakevenPricePerSqm,
    },
    revenue: {
      pricingBasis:
        input.saleMode === "PER_SQM" && input.currentSellingPricePerSqm
          ? "INPUT"
          : input.saleMode === "PER_SQM"
            ? "RECOMMENDED_MINIMUM"
            : "INPUT",
      effectiveSellingPricePerSqm,
      estimatedRevenue,
      estimatedGrossProfit,
      roiPercent,
      marginPercent,
      profitPerSqm,
      breakevenPricePerSqm,
      minimumSellingPricePerSqm,
    },
    pricing: {
      outrightRecommendedPricePerSqm,
      installmentRecommendedPricePerSqm,
      outrightRecommendedRevenue,
      installmentRecommendedRevenue,
      installmentPremiumRateApplied: roundTo(
        installmentPremiumRateApplied + installmentInflationPremium * 100,
      ),
    },
    salesMix: {
      allocatedSqm,
      allocatedPercentOfSellable: roundTo(safeDivide(allocatedSqm, sellableSqm) * 100),
      items: normalizedSalesItems,
    },
    phasing,
    scenarios,
    warnings,
  };
}

function calculateDevelopmentFeasibilityBaseOnly(input: DevelopmentCalculationInput) {
  const result = calculateDevelopmentFeasibilityBase(input);
  return result;
}

function calculateDevelopmentFeasibilityBase(input: DevelopmentCalculationInput) {
  const grossSqm = roundTo(input.landSizeHectares * HECTARE_TO_SQM, 2);
  const reservedPercentage = roundTo(
    input.roadsPercentage +
      input.drainagePercentage +
      input.greenAreaPercentage +
      input.utilitiesPercentage,
  );
  const sellableSqm = roundTo(
    Math.max(grossSqm - grossSqm * percentageToDecimal(reservedPercentage), 0),
    2,
  );
  const landAcquisitionCost = sumCostFields([
    input.landPurchasePrice,
    input.surveyCost,
    input.legalDocumentationCost,
    input.titlePerfectionCost,
  ]);
  const totalDevelopmentCost = sumCostFields([
    input.siteClearingCost,
    input.sandFillingEarthworkCost,
    input.roadConstructionCost,
    input.drainageCost,
    input.powerInfrastructureCost,
    input.waterInfrastructureCost,
    input.fencingGatehouseSecurityCost,
  ]);
  const totalOperatingCost = sumCostFields([
    input.marketingSalesCommissionCost,
    input.adminCost,
    input.contingencyCost,
  ]);
  const projectYears = input.projectDurationMonths / 12;
  const salesYears = input.salesDurationMonths / 12;
  const inflationMultiplier = Math.pow(
    1 + percentageToDecimal(input.annualInflationRate),
    projectYears,
  );
  const escalationMultiplier = Math.pow(
    1 + percentageToDecimal(input.constructionCostEscalationRate),
    projectYears,
  );
  const salesAppreciationMultiplier = Math.pow(
    1 + percentageToDecimal(input.annualSellingPriceAppreciationRate),
    salesYears,
  );
  const inflationAdjustedOperatingCost = roundTo(totalOperatingCost * inflationMultiplier);
  const escalatedDevelopmentCost = roundTo(totalDevelopmentCost * escalationMultiplier);
  const riskProvisionCost = roundTo(
    (landAcquisitionCost + escalatedDevelopmentCost + inflationAdjustedOperatingCost) *
      percentageToDecimal(input.marketRiskPremiumRate),
  );
  const financingCost = roundTo(
    (landAcquisitionCost + escalatedDevelopmentCost + inflationAdjustedOperatingCost) *
      percentageToDecimal(input.financingCostRate) *
      projectYears,
  );
  const adjustedTotalCost = roundTo(
    landAcquisitionCost +
      escalatedDevelopmentCost +
      inflationAdjustedOperatingCost +
      riskProvisionCost +
      financingCost,
  );
  const minimumSellingPricePerSqm = roundTo(
    safeDivide(adjustedTotalCost, sellableSqm) *
      (1 + percentageToDecimal(input.requiredTargetProfitMarginRate)),
  );
  const estimatedRevenue =
    input.saleMode === "PER_SQM"
      ? roundTo(
          sellableSqm *
            ((input.currentSellingPricePerSqm ?? minimumSellingPricePerSqm) *
              salesAppreciationMultiplier),
        )
      : roundTo(
          input.salesMixItems.reduce((sum, item) => {
            const price =
              item.priceMode === "PER_SQM"
                ? (item.pricePerSqm ?? 0) * item.sizeSqm
                : item.unitPrice ?? 0;
            return sum + price * item.quantity * salesAppreciationMultiplier;
          }, 0),
        );
  const estimatedGrossProfit = roundTo(estimatedRevenue - adjustedTotalCost);
  const roiPercent = roundTo(safeDivide(estimatedGrossProfit, adjustedTotalCost) * 100);
  const marginPercent = roundTo(safeDivide(estimatedGrossProfit, estimatedRevenue) * 100);

  return {
    adjustedTotalCost,
    estimatedRevenue,
    estimatedGrossProfit,
    roiPercent,
    marginPercent,
    minimumSellingPricePerSqm,
  };
}

export function createBlankSalesMixItem(index = 0): DevelopmentSalesMixItemInput {
  return {
    id: `draft-${index + 1}`,
    label: `Category ${index + 1}`,
    quantity: 1,
    sizeSqm: STANDARD_PLOT_SQM,
    priceMode: "PER_UNIT",
    unitPrice: 0,
  };
}

export function createBlankDevelopmentPhase(
  index = 0,
): DevelopmentCalculationPhaseInput {
  return {
    id: `phase-${index + 1}`,
    name: `Phase ${index + 1}`,
    startMonthOffset: index * 6,
    durationMonths: 6,
    developmentCostShare: index === 0 ? 100 : 0,
    sellableInventoryShare: index === 0 ? 100 : 0,
    sellingPriceUpliftRate: 0,
    salesVelocityRate: 100,
    notes: "",
  };
}

export function createBlankDevelopmentCalculation(
  currency = "NGN",
): DevelopmentCalculationInput {
  return {
    projectName: "",
    location: "",
    notes: "",
    currency,
    landSizeHectares: 10,
    landPurchasePrice: 0,
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
    currentSellingPricePerSqm: 0,
    paymentMode: "OUTRIGHT",
    installmentTenureMonths: 12,
    installmentPremiumRate: 12,
    useInflationAdjustedInstallmentPricing: true,
    salesMixItems: [createBlankSalesMixItem(0)],
    phases: [],
  };
}
