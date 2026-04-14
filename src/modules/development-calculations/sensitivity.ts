import type { DevelopmentCalculationInput } from "@/lib/validations/development-calculations";
import {
  calculateDevelopmentFeasibility,
  createBlankDevelopmentPhase,
  type DevelopmentCalculationResult,
} from "@/modules/development-calculations/engine";

export type QuickAdjustKey =
  | "SELLING_PRICE"
  | "RESERVED_LAND"
  | "DEVELOPMENT_COST"
  | "SALES_VELOCITY"
  | "PHASE_TIMING"
  | "TARGET_MARGIN";

export type SensitivityVariableKey =
  | "SELLING_PRICE"
  | "DEVELOPMENT_COST"
  | "SELLABLE_LAND";

export type SensitivitySnapshot = {
  key: SensitivityVariableKey;
  label: string;
  down: DevelopmentCalculationResult;
  base: DevelopmentCalculationResult;
  up: DevelopmentCalculationResult;
  roiSpread: number;
  profitSpread: number;
};

const DEVELOPMENT_COST_FIELDS: Array<keyof DevelopmentCalculationInput> = [
  "siteClearingCost",
  "sandFillingEarthworkCost",
  "roadConstructionCost",
  "drainageCost",
  "powerInfrastructureCost",
  "waterInfrastructureCost",
  "fencingGatehouseSecurityCost",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function deepCloneInput(input: DevelopmentCalculationInput): DevelopmentCalculationInput {
  return {
    ...input,
    salesMixItems: input.salesMixItems.map((item) => ({ ...item })),
    phases: input.phases.map((phase) => ({ ...phase })),
  };
}

function ensureVelocityPhases(input: DevelopmentCalculationInput) {
  if (input.phases.length > 0) {
    return input.phases.map((phase) => ({ ...phase }));
  }

  return [
    {
      ...createBlankDevelopmentPhase(0),
      name: "Whole project",
      developmentCostShare: 100,
      sellableInventoryShare: 100,
      salesVelocityRate: 100,
      startMonthOffset: 0,
      durationMonths: Math.max(input.salesDurationMonths, input.projectDurationMonths, 1),
    },
  ];
}

function scaleSellingPrice(input: DevelopmentCalculationInput, delta: number) {
  const factor = 1 + delta;

  if (input.saleMode === "PER_SQM") {
    input.currentSellingPricePerSqm = roundTo(
      Math.max((input.currentSellingPricePerSqm ?? 0) * factor, 0),
    );
    return;
  }

  input.salesMixItems = input.salesMixItems.map((item) => ({
    ...item,
    pricePerSqm:
      item.pricePerSqm != null ? roundTo(Math.max(item.pricePerSqm * factor, 0)) : item.pricePerSqm,
    unitPrice:
      item.unitPrice != null ? roundTo(Math.max(item.unitPrice * factor, 0)) : item.unitPrice,
  }));
}

function scaleReservedLand(input: DevelopmentCalculationInput, delta: number) {
  const currentTotal =
    input.roadsPercentage +
    input.drainagePercentage +
    input.greenAreaPercentage +
    input.utilitiesPercentage;
  const nextTotal = clamp(roundTo(currentTotal * (1 + delta)), 5, 85);

  if (currentTotal <= 0) {
    input.roadsPercentage = roundTo(nextTotal * 0.4);
    input.drainagePercentage = roundTo(nextTotal * 0.2);
    input.greenAreaPercentage = roundTo(nextTotal * 0.2);
    input.utilitiesPercentage = roundTo(nextTotal * 0.2);
    return;
  }

  const ratio = nextTotal / currentTotal;
  input.roadsPercentage = roundTo(input.roadsPercentage * ratio);
  input.drainagePercentage = roundTo(input.drainagePercentage * ratio);
  input.greenAreaPercentage = roundTo(input.greenAreaPercentage * ratio);
  input.utilitiesPercentage = roundTo(input.utilitiesPercentage * ratio);
}

function scaleDevelopmentCosts(input: DevelopmentCalculationInput, delta: number) {
  const factor = 1 + delta;
  const mutableInput = input as unknown as Record<string, number>;

  DEVELOPMENT_COST_FIELDS.forEach((field) => {
    mutableInput[field as string] = roundTo(
      Math.max(Number(mutableInput[field as string]) * factor, 0),
    );
  });
}

function scaleSalesVelocity(input: DevelopmentCalculationInput, delta: number) {
  input.phases = ensureVelocityPhases(input).map((phase) => ({
    ...phase,
    salesVelocityRate: roundTo(clamp(phase.salesVelocityRate * (1 + delta), 10, 100)),
  }));
}

function scalePhaseTiming(input: DevelopmentCalculationInput, delta: number) {
  const factor = clamp(1 + delta, 0.6, 1.6);
  input.projectDurationMonths = Math.max(1, Math.round(input.projectDurationMonths * factor));
  input.salesDurationMonths = Math.max(1, Math.round(input.salesDurationMonths * factor));

  if (input.phases.length > 0) {
    input.phases = input.phases.map((phase) => ({
      ...phase,
      startMonthOffset: Math.max(0, Math.round(phase.startMonthOffset * factor)),
      durationMonths: Math.max(1, Math.round(phase.durationMonths * factor)),
    }));
  }
}

function scaleTargetMargin(input: DevelopmentCalculationInput, delta: number) {
  input.requiredTargetProfitMarginRate = roundTo(
    clamp(input.requiredTargetProfitMarginRate * (1 + delta), 5, 60),
  );
}

export function applyQuickAdjustment(
  source: DevelopmentCalculationInput,
  key: QuickAdjustKey,
  delta: number,
) {
  const input = deepCloneInput(source);

  if (key === "SELLING_PRICE") {
    scaleSellingPrice(input, delta);
  }

  if (key === "RESERVED_LAND") {
    scaleReservedLand(input, delta);
  }

  if (key === "DEVELOPMENT_COST") {
    scaleDevelopmentCosts(input, delta);
  }

  if (key === "SALES_VELOCITY") {
    scaleSalesVelocity(input, delta);
  }

  if (key === "PHASE_TIMING") {
    scalePhaseTiming(input, delta);
  }

  if (key === "TARGET_MARGIN") {
    scaleTargetMargin(input, delta);
  }

  return input;
}

export function buildSensitivitySnapshots(
  input: DevelopmentCalculationInput,
  base: DevelopmentCalculationResult,
): SensitivitySnapshot[] {
  const definitions: Array<{ key: SensitivityVariableKey; label: string; downDelta: number; upDelta: number; adjustKey: QuickAdjustKey }> = [
    {
      key: "SELLING_PRICE",
      label: "Selling price",
      downDelta: -0.1,
      upDelta: 0.1,
      adjustKey: "SELLING_PRICE",
    },
    {
      key: "DEVELOPMENT_COST",
      label: "Development cost",
      downDelta: -0.1,
      upDelta: 0.1,
      adjustKey: "DEVELOPMENT_COST",
    },
    {
      key: "SELLABLE_LAND",
      label: "Sellable land",
      downDelta: 0.08,
      upDelta: -0.08,
      adjustKey: "RESERVED_LAND",
    },
  ];

  return definitions.map((definition) => {
    const down = calculateDevelopmentFeasibility(
      applyQuickAdjustment(input, definition.adjustKey, definition.downDelta),
    );
    const up = calculateDevelopmentFeasibility(
      applyQuickAdjustment(input, definition.adjustKey, definition.upDelta),
    );

    return {
      key: definition.key,
      label: definition.label,
      down,
      base,
      up,
      roiSpread: Math.abs(up.revenue.roiPercent - down.revenue.roiPercent),
      profitSpread: Math.abs(up.revenue.estimatedGrossProfit - down.revenue.estimatedGrossProfit),
    };
  });
}

export function getMostSensitiveVariable(snapshots: SensitivitySnapshot[]) {
  return [...snapshots].sort((left, right) => right.roiSpread - left.roiSpread)[0] ?? null;
}

export function getLeastSensitiveVariable(snapshots: SensitivitySnapshot[]) {
  return [...snapshots].sort((left, right) => left.roiSpread - right.roiSpread)[0] ?? null;
}
