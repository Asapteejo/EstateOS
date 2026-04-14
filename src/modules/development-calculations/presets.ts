import type { DevelopmentCalculationInput } from "@/lib/validations/development-calculations";
import {
  createBlankDevelopmentCalculation,
  createBlankDevelopmentPhase,
} from "@/modules/development-calculations/engine";

export type DevelopmentPresetKey = "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";

type DevelopmentPresetDefinition = {
  key: DevelopmentPresetKey;
  label: string;
  summary: string;
  guidance: string;
  quickStartPhases: number;
  assumptions: {
    roadsPercentage: number;
    drainagePercentage: number;
    greenAreaPercentage: number;
    utilitiesPercentage: number;
    annualInflationRate: number;
    constructionCostEscalationRate: number;
    annualSellingPriceAppreciationRate: number;
    marketRiskPremiumRate: number;
    financingCostRate: number;
    requiredTargetProfitMarginRate: number;
    paymentMode: DevelopmentCalculationInput["paymentMode"];
    installmentTenureMonths: number;
    installmentPremiumRate: number;
    useInflationAdjustedInstallmentPricing: boolean;
    costRatios: {
      surveyCost: number;
      legalDocumentationCost: number;
      titlePerfectionCost: number;
      siteClearingCost: number;
      sandFillingEarthworkCost: number;
      roadConstructionCost: number;
      drainageCost: number;
      powerInfrastructureCost: number;
      waterInfrastructureCost: number;
      fencingGatehouseSecurityCost: number;
      marketingSalesCommissionCost: number;
      adminCost: number;
      contingencyCost: number;
    };
  };
};

export const DEVELOPMENT_PRESETS: DevelopmentPresetDefinition[] = [
  {
    key: "AGGRESSIVE",
    label: "Aggressive",
    summary: "Higher margin target, faster sell-through expectations, and a leaner infrastructure reserve posture.",
    guidance: "Use when the market is strong, the location carries pricing power, and you are comfortable with tighter execution buffers.",
    quickStartPhases: 2,
    assumptions: {
      roadsPercentage: 14,
      drainagePercentage: 4,
      greenAreaPercentage: 4,
      utilitiesPercentage: 4,
      annualInflationRate: 14,
      constructionCostEscalationRate: 10,
      annualSellingPriceAppreciationRate: 14,
      marketRiskPremiumRate: 4,
      financingCostRate: 0,
      requiredTargetProfitMarginRate: 32,
      paymentMode: "OUTRIGHT",
      installmentTenureMonths: 9,
      installmentPremiumRate: 10,
      useInflationAdjustedInstallmentPricing: true,
      costRatios: {
        surveyCost: 0.012,
        legalDocumentationCost: 0.01,
        titlePerfectionCost: 0.018,
        siteClearingCost: 0.018,
        sandFillingEarthworkCost: 0.032,
        roadConstructionCost: 0.08,
        drainageCost: 0.04,
        powerInfrastructureCost: 0.03,
        waterInfrastructureCost: 0.02,
        fencingGatehouseSecurityCost: 0.025,
        marketingSalesCommissionCost: 0.03,
        adminCost: 0.015,
        contingencyCost: 0.025,
      },
    },
  },
  {
    key: "BALANCED",
    label: "Balanced",
    summary: "Moderate reserves, realistic growth assumptions, and a margin target suitable for management review.",
    guidance: "Use for most first-pass feasibility work when you want a commercially credible base case before market stress testing.",
    quickStartPhases: 3,
    assumptions: {
      roadsPercentage: 15,
      drainagePercentage: 5,
      greenAreaPercentage: 5,
      utilitiesPercentage: 5,
      annualInflationRate: 18,
      constructionCostEscalationRate: 12,
      annualSellingPriceAppreciationRate: 10,
      marketRiskPremiumRate: 5,
      financingCostRate: 0,
      requiredTargetProfitMarginRate: 25,
      paymentMode: "OUTRIGHT",
      installmentTenureMonths: 12,
      installmentPremiumRate: 12,
      useInflationAdjustedInstallmentPricing: true,
      costRatios: {
        surveyCost: 0.015,
        legalDocumentationCost: 0.012,
        titlePerfectionCost: 0.022,
        siteClearingCost: 0.025,
        sandFillingEarthworkCost: 0.05,
        roadConstructionCost: 0.11,
        drainageCost: 0.055,
        powerInfrastructureCost: 0.04,
        waterInfrastructureCost: 0.03,
        fencingGatehouseSecurityCost: 0.03,
        marketingSalesCommissionCost: 0.04,
        adminCost: 0.02,
        contingencyCost: 0.04,
      },
    },
  },
  {
    key: "CONSERVATIVE",
    label: "Conservative",
    summary: "Heavier delivery buffers, slower market uplift, and more protection against inflation and execution drag.",
    guidance: "Use when infrastructure delivery is uncertain, pricing power is still unproven, or investors need a more defensive plan.",
    quickStartPhases: 3,
    assumptions: {
      roadsPercentage: 17,
      drainagePercentage: 6,
      greenAreaPercentage: 6,
      utilitiesPercentage: 6,
      annualInflationRate: 22,
      constructionCostEscalationRate: 16,
      annualSellingPriceAppreciationRate: 7,
      marketRiskPremiumRate: 7,
      financingCostRate: 3,
      requiredTargetProfitMarginRate: 20,
      paymentMode: "INSTALLMENT",
      installmentTenureMonths: 18,
      installmentPremiumRate: 15,
      useInflationAdjustedInstallmentPricing: true,
      costRatios: {
        surveyCost: 0.016,
        legalDocumentationCost: 0.014,
        titlePerfectionCost: 0.025,
        siteClearingCost: 0.03,
        sandFillingEarthworkCost: 0.06,
        roadConstructionCost: 0.13,
        drainageCost: 0.07,
        powerInfrastructureCost: 0.05,
        waterInfrastructureCost: 0.035,
        fencingGatehouseSecurityCost: 0.035,
        marketingSalesCommissionCost: 0.05,
        adminCost: 0.025,
        contingencyCost: 0.05,
      },
    },
  },
];

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getDevelopmentPresetDefinition(key: DevelopmentPresetKey) {
  return DEVELOPMENT_PRESETS.find((preset) => preset.key === key) ?? DEVELOPMENT_PRESETS[1]!;
}

export function createPhaseTemplateFromPreset(count: number) {
  const share = Number((100 / count).toFixed(2));

  return Array.from({ length: count }, (_, index) => ({
    ...createBlankDevelopmentPhase(index),
    durationMonths: 6,
    startMonthOffset: index * 6,
    developmentCostShare:
      index === count - 1 ? Number((100 - share * (count - 1)).toFixed(2)) : share,
    sellableInventoryShare:
      index === count - 1 ? Number((100 - share * (count - 1)).toFixed(2)) : share,
    salesVelocityRate: count === 2 ? (index === 0 ? 85 : 100) : index === 0 ? 75 : index === 1 ? 85 : 100,
  }));
}

export function applyDevelopmentPreset(
  base: DevelopmentCalculationInput,
  key: DevelopmentPresetKey,
) {
  const preset = getDevelopmentPresetDefinition(key);
  const purchasePrice = Math.max(base.landPurchasePrice, 0);
  const blank = createBlankDevelopmentCalculation(base.currency || "NGN");
  const ratios = preset.assumptions.costRatios;

  return {
    ...blank,
    ...base,
    roadsPercentage: preset.assumptions.roadsPercentage,
    drainagePercentage: preset.assumptions.drainagePercentage,
    greenAreaPercentage: preset.assumptions.greenAreaPercentage,
    utilitiesPercentage: preset.assumptions.utilitiesPercentage,
    annualInflationRate: preset.assumptions.annualInflationRate,
    constructionCostEscalationRate: preset.assumptions.constructionCostEscalationRate,
    annualSellingPriceAppreciationRate: preset.assumptions.annualSellingPriceAppreciationRate,
    marketRiskPremiumRate: preset.assumptions.marketRiskPremiumRate,
    financingCostRate: preset.assumptions.financingCostRate,
    requiredTargetProfitMarginRate: preset.assumptions.requiredTargetProfitMarginRate,
    paymentMode: preset.assumptions.paymentMode,
    installmentTenureMonths: preset.assumptions.installmentTenureMonths,
    installmentPremiumRate: preset.assumptions.installmentPremiumRate,
    useInflationAdjustedInstallmentPricing:
      preset.assumptions.useInflationAdjustedInstallmentPricing,
    surveyCost: roundTo(purchasePrice * ratios.surveyCost),
    legalDocumentationCost: roundTo(purchasePrice * ratios.legalDocumentationCost),
    titlePerfectionCost: roundTo(purchasePrice * ratios.titlePerfectionCost),
    siteClearingCost: roundTo(purchasePrice * ratios.siteClearingCost),
    sandFillingEarthworkCost: roundTo(purchasePrice * ratios.sandFillingEarthworkCost),
    roadConstructionCost: roundTo(purchasePrice * ratios.roadConstructionCost),
    drainageCost: roundTo(purchasePrice * ratios.drainageCost),
    powerInfrastructureCost: roundTo(purchasePrice * ratios.powerInfrastructureCost),
    waterInfrastructureCost: roundTo(purchasePrice * ratios.waterInfrastructureCost),
    fencingGatehouseSecurityCost: roundTo(
      purchasePrice * ratios.fencingGatehouseSecurityCost,
    ),
    marketingSalesCommissionCost: roundTo(
      purchasePrice * ratios.marketingSalesCommissionCost,
    ),
    adminCost: roundTo(purchasePrice * ratios.adminCost),
    contingencyCost: roundTo(purchasePrice * ratios.contingencyCost),
    phases: createPhaseTemplateFromPreset(preset.quickStartPhases),
  } satisfies DevelopmentCalculationInput;
}

export function inferDevelopmentPreset(
  input: DevelopmentCalculationInput,
): DevelopmentPresetKey | null {
  const candidates = DEVELOPMENT_PRESETS.map((preset) => {
    const assumptions = preset.assumptions;
    const score =
      Math.abs(input.roadsPercentage - assumptions.roadsPercentage) +
      Math.abs(input.drainagePercentage - assumptions.drainagePercentage) +
      Math.abs(input.greenAreaPercentage - assumptions.greenAreaPercentage) +
      Math.abs(input.utilitiesPercentage - assumptions.utilitiesPercentage) +
      Math.abs(input.annualInflationRate - assumptions.annualInflationRate) +
      Math.abs(
        input.constructionCostEscalationRate -
          assumptions.constructionCostEscalationRate,
      ) +
      Math.abs(
        input.annualSellingPriceAppreciationRate -
          assumptions.annualSellingPriceAppreciationRate,
      ) +
      Math.abs(input.marketRiskPremiumRate - assumptions.marketRiskPremiumRate) +
      Math.abs(input.requiredTargetProfitMarginRate - assumptions.requiredTargetProfitMarginRate);

    return {
      key: preset.key,
      score,
    };
  }).sort((left, right) => left.score - right.score);

  return candidates[0] && candidates[0].score <= 8 ? candidates[0].key : null;
}

export function getPresetDeviationWarnings(input: DevelopmentCalculationInput) {
  const warnings: string[] = [];
  const reserved =
    input.roadsPercentage +
    input.drainagePercentage +
    input.greenAreaPercentage +
    input.utilitiesPercentage;

  if (reserved < 18) {
    warnings.push("Reserved land looks unusually lean for a serviced estate. Recheck roads, drainage, and shared-use allowances.");
  }

  if (reserved > 40) {
    warnings.push("Reserved land is unusually heavy and may suppress revenue capacity more than expected.");
  }

  if (input.annualInflationRate > 28 || input.constructionCostEscalationRate > 22) {
    warnings.push("Inflation and escalation assumptions are materially above normal planning ranges. Stress-test pricing and phasing carefully.");
  }

  if (input.annualSellingPriceAppreciationRate > 18) {
    warnings.push("Selling price appreciation is aggressive. Make sure the market can actually absorb that pricing path.");
  }

  if (input.requiredTargetProfitMarginRate >= 35) {
    warnings.push("Target margin is moving into an aggressive range and may require exceptional demand depth.");
  }

  if (input.financingCostRate >= 8) {
    warnings.push("Financing cost is high enough to put timing and liquidity under pressure. Review the phase plan closely.");
  }

  return warnings;
}
