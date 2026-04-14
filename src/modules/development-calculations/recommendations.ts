import type { DevelopmentCalculationInput } from "@/lib/validations/development-calculations";
import type { DevelopmentCalculationResult } from "@/modules/development-calculations/engine";

export type RecommendationSeverity = "CRITICAL" | "WATCH" | "OPPORTUNITY";
export type RecommendationCategory =
  | "Pricing"
  | "Land utilization"
  | "Cost structure"
  | "Phasing and timing"
  | "Liquidity / funding gap"
  | "Margin posture"
  | "Sales model choice"
  | "Installment risk/opportunity";

export type CalculatorRecommendation = {
  id: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  title: string;
  message: string;
};

export type CalculatorLeverage = {
  label: string;
  reason: string;
};

export type CalculatorRecommendationBundle = {
  recommendations: CalculatorRecommendation[];
  biggestLevers: CalculatorLeverage[];
};

export type ComparisonRecommendation = {
  title: string;
  message: string;
  severity: Exclude<RecommendationSeverity, "WATCH"> | "WATCH";
};

export type ComparisonRecommendationBundle = {
  recommendations: ComparisonRecommendation[];
};

function safeDivide(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function pushRecommendation(
  items: CalculatorRecommendation[],
  recommendation: CalculatorRecommendation,
) {
  items.push(recommendation);
}

function severityRank(severity: RecommendationSeverity) {
  if (severity === "CRITICAL") {
    return 0;
  }

  if (severity === "WATCH") {
    return 1;
  }

  return 2;
}

export function buildCalculatorRecommendations(
  input: DevelopmentCalculationInput,
  result: DevelopmentCalculationResult,
): CalculatorRecommendationBundle {
  const recommendations: CalculatorRecommendation[] = [];
  const pricingCushionRatio = safeDivide(
    result.revenue.effectiveSellingPricePerSqm - result.revenue.breakevenPricePerSqm,
    result.revenue.breakevenPricePerSqm,
  );
  const reservedLand = result.area.reservedPercentage;
  const downsideScenario = result.scenarios.find((scenario) => scenario.key === "WORST");
  const blendedDevelopmentEscalation = safeDivide(
    result.costs.escalatedDevelopmentCost - result.costs.totalDevelopmentCost,
    result.costs.totalDevelopmentCost,
  );
  const fundingGapRatio = safeDivide(
    result.phasing.peakFundingGap,
    result.costs.adjustedTotalCost,
  );
  const paybackRatio = safeDivide(
    result.phasing.paybackMonth ?? input.salesDurationMonths + input.projectDurationMonths,
    input.projectDurationMonths + input.salesDurationMonths,
  );

  if (pricingCushionRatio <= 0.08) {
    pushRecommendation(recommendations, {
      id: "pricing-thin-cushion",
      severity: pricingCushionRatio <= 0 ? "CRITICAL" : "WATCH",
      category: "Pricing",
      title: "Pricing cushion is thin",
      message:
        pricingCushionRatio <= 0
          ? "The current selling price sits at or below break-even. Raise the headline rate, reduce delivery cost, or improve land efficiency before using this as a live commercial price."
          : "The gap between break-even and current pricing is narrow. A modest cost shock or slower absorption could erase margin protection.",
    });
  }

  if (reservedLand >= 38) {
    pushRecommendation(recommendations, {
      id: "land-efficiency-risk",
      severity: reservedLand >= 45 ? "CRITICAL" : "WATCH",
      category: "Land utilization",
      title: "Land efficiency is under pressure",
      message:
        reservedLand >= 45
          ? "Reserved land is consuming a very large share of the estate. Rework infrastructure allocation or accept that the project needs materially higher pricing to compensate."
          : "Reserved land is high enough to weaken sellable efficiency. Review roads, drainage, and shared-use assumptions before final pricing.",
    });
  }

  if (blendedDevelopmentEscalation >= 0.18) {
    pushRecommendation(recommendations, {
      id: "cost-escalation-pressure",
      severity: blendedDevelopmentEscalation >= 0.25 ? "CRITICAL" : "WATCH",
      category: "Cost structure",
      title: "Escalation is adding heavy delivery pressure",
      message:
        blendedDevelopmentEscalation >= 0.25
          ? "Construction escalation is materially increasing delivery cost. Tighten phasing, procurement timing, or infrastructure scope before assuming the current return will hold."
          : "Escalation is meaningfully lifting the development stack. Keep procurement timing and phase sequencing under close review.",
    });
  }

  if (result.phasing.paybackMonth == null || paybackRatio > 0.85) {
    pushRecommendation(recommendations, {
      id: "slow-payback",
      severity: result.phasing.paybackMonth == null ? "CRITICAL" : "WATCH",
      category: "Phasing and timing",
      title: "Cash recovery is slow",
      message:
        result.phasing.paybackMonth == null
          ? "The project does not recover cumulative cash inside the current timing window. Revisit sell-through, release timing, or pricing before relying on this plan."
          : "Payback arrives late in the plan. Tighten phase cadence or strengthen early-phase absorption so the project recovers cash faster.",
    });
  }

  if (fundingGapRatio >= 0.25) {
    pushRecommendation(recommendations, {
      id: "funding-gap",
      severity: fundingGapRatio >= 0.4 ? "CRITICAL" : "WATCH",
      category: "Liquidity / funding gap",
      title: "Funding gap is material",
      message:
        fundingGapRatio >= 0.4
          ? "Peak funding exposure is severe relative to project cost. Redistribute development loading, slow later delivery, or secure funding cover before committing."
          : "Liquidity pressure is meaningful. Review phase cost loading and the timing of early sales to reduce the peak cash deficit.",
    });
  }

  if (result.revenue.marginPercent <= 12 || input.requiredTargetProfitMarginRate >= 35) {
    pushRecommendation(recommendations, {
      id: "margin-posture",
      severity: result.revenue.marginPercent <= 8 ? "CRITICAL" : "WATCH",
      category: "Margin posture",
      title:
        input.requiredTargetProfitMarginRate >= 35
          ? "Margin target is aggressive"
          : "Margin posture is thin",
      message:
        input.requiredTargetProfitMarginRate >= 35
          ? "The target margin is stretching into aggressive territory. Make sure demand depth and brand positioning genuinely support it."
          : "Projected margin leaves limited room for execution slippage. Increase price discipline or remove cost pressure before taking the plan forward.",
    });
  }

  if (input.saleMode !== "PER_SQM" && result.salesMix.allocatedPercentOfSellable < 75) {
    pushRecommendation(recommendations, {
      id: "sales-model-coverage",
      severity: result.salesMix.allocatedPercentOfSellable < 55 ? "CRITICAL" : "WATCH",
      category: "Sales model choice",
      title: "The sales model does not yet cover enough inventory",
      message:
        result.salesMix.allocatedPercentOfSellable < 55
          ? "A large share of sellable land is not mapped into the commercial mix. Revenue quality is still too incomplete for a confident pricing decision."
          : "Inventory coverage is partial. Add more product categories or confirm that the unallocated land is intentionally excluded from the current release.",
    });
  }

  if (input.paymentMode === "INSTALLMENT") {
    const upliftRatio = safeDivide(
      result.pricing.installmentRecommendedPricePerSqm - result.pricing.outrightRecommendedPricePerSqm,
      result.pricing.outrightRecommendedPricePerSqm,
    );

    if (upliftRatio >= 0.18 && result.phasing.peakFundingGap > 0) {
      pushRecommendation(recommendations, {
        id: "installment-tradeoff",
        severity: "WATCH",
        category: "Installment risk/opportunity",
        title: "Installment pricing helps revenue, but liquidity still needs attention",
        message:
          "The installment headline creates meaningful price uplift, but the project still carries a funding gap. Treat installment as a margin tool, not a substitute for cashflow discipline.",
      });
    } else if (upliftRatio >= 0.12) {
      pushRecommendation(recommendations, {
        id: "installment-opportunity",
        severity: "OPPORTUNITY",
        category: "Installment risk/opportunity",
        title: "Installment terms can create a pricing opportunity",
        message:
          "The installment structure produces a healthy uplift over outright pricing. If market affordability is a constraint, financed offers may improve commercial headroom without immediately changing base land price.",
      });
    }
  }

  if ((downsideScenario?.roiPercent ?? 0) < 0 || (downsideScenario?.marginPercent ?? 0) < 10) {
    pushRecommendation(recommendations, {
      id: "downside-fragility",
      severity: (downsideScenario?.roiPercent ?? 0) < -5 ? "CRITICAL" : "WATCH",
      category: "Phasing and timing",
      title: "Downside scenario is fragile",
      message:
        (downsideScenario?.roiPercent ?? 0) < -5
          ? "The downside case turns materially unattractive. Use a more conservative pricing stance or de-risk timing before taking this project to investors."
          : "The downside case weakens quickly. Stress-test timing and delivery cost further before presenting the model as robust.",
    });
  }

  const biggestLevers: CalculatorLeverage[] = [];

  if (pricingCushionRatio <= 0.12) {
    biggestLevers.push({
      label: "Selling price",
      reason: "A small improvement in headline pricing would create the fastest relief for thin break-even cushion.",
    });
  }

  if (reservedLand >= 35) {
    biggestLevers.push({
      label: "Reserved land %",
      reason: "Land efficiency is constraining sellable inventory and directly pushing up the required price per sqm.",
    });
  }

  if (blendedDevelopmentEscalation >= 0.15 || result.costs.totalDevelopmentCost > result.costs.landAcquisitionCost) {
    biggestLevers.push({
      label: "Development cost load",
      reason: "Infrastructure-heavy delivery cost is one of the biggest drivers of break-even and liquidity pressure.",
    });
  }

  if (fundingGapRatio >= 0.2 || result.phasing.paybackMonth == null) {
    biggestLevers.push({
      label: "Phasing speed",
      reason: "Earlier recovery and lighter early cost loading would reduce the funding gap and improve payback timing.",
    });
  }

  if (result.phasing.realizedSellThroughShare < 80) {
    biggestLevers.push({
      label: "Sell-through",
      reason: "Stronger absorption would improve realized revenue and shorten cash recovery without changing land efficiency.",
    });
  }

  return {
    recommendations: recommendations.sort(
      (left, right) => severityRank(left.severity) - severityRank(right.severity),
    ),
    biggestLevers: biggestLevers.slice(0, 3),
  };
}

export function buildComparisonRecommendations(
  candidates: Array<{
    label: string;
    form: DevelopmentCalculationInput;
    result: DevelopmentCalculationResult;
  }>,
): ComparisonRecommendationBundle {
  if (candidates.length < 2) {
    return { recommendations: [] };
  }

  const safest = [...candidates].sort(
    (left, right) => left.result.phasing.peakFundingGap - right.result.phasing.peakFundingGap,
  )[0]!;
  const mostProfitable = [...candidates].sort(
    (left, right) => right.result.revenue.roiPercent - left.result.revenue.roiPercent,
  )[0]!;
  const fastest = [...candidates].sort(
    (left, right) =>
      (left.result.phasing.paybackMonth ?? Number.POSITIVE_INFINITY) -
      (right.result.phasing.paybackMonth ?? Number.POSITIVE_INFINITY),
  )[0]!;

  const recommendations: ComparisonRecommendation[] = [
    {
      title: "Safest option",
      severity: "WATCH",
      message: `${safest.label} carries the lightest liquidity burden because its peak funding gap is lowest at ${safest.result.phasing.peakFundingGap.toFixed(2)} in model currency terms.`,
    },
    {
      title: "Most profitable option",
      severity: "OPPORTUNITY",
      message: `${mostProfitable.label} leads on ROI at ${mostProfitable.result.revenue.roiPercent.toFixed(1)}%, making it the strongest upside case in this set.`,
    },
    {
      title: "Fastest timing profile",
      severity:
        fastest.result.phasing.paybackMonth == null ? "CRITICAL" : "WATCH",
      message:
        fastest.result.phasing.paybackMonth == null
          ? "None of the compared options reaches payback inside the current plan window, so timing risk remains unresolved across the set."
          : `${fastest.label} recovers cash fastest by month ${fastest.result.phasing.paybackMonth}, but confirm the tradeoff against margin and pricing discipline in the other options.`,
    },
  ];

  return { recommendations };
}
