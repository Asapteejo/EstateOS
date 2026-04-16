import Link from "next/link";
import { notFound } from "next/navigation";

import { InvestorReportView } from "@/components/admin/development-calculator-workspace";
import { FeasibilityAiNarrative } from "@/components/admin/feasibility-ai-narrative";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { calculateDevelopmentFeasibility } from "@/modules/development-calculations/engine";
import { buildCalculatorRecommendations } from "@/modules/development-calculations/recommendations";
import { getDevelopmentCalculationDetail } from "@/modules/development-calculations/service";

function getWarningTone(warning: string): "danger" | "caution" {
  const normalized = warning.toLowerCase();

  if (
    normalized.includes("below break-even") ||
    normalized.includes("no sellable land") ||
    normalized.includes("exceeds sellable")
  ) {
    return "danger";
  }

  return "caution";
}

export default async function AdminFeasibilityDecisionPage({
  params,
}: {
  params: Promise<{ calculationId: string }>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const { calculationId } = await params;
  const detail = await getDevelopmentCalculationDetail(tenant, calculationId);

  if (!detail) {
    notFound();
  }

  const form = detail.form;
  const results = detail.result ?? calculateDevelopmentFeasibility(form);
  const activeWarnings = results.warnings.filter((warning) => getWarningTone(warning) === "danger");
  const cautionWarnings = results.warnings.filter((warning) => getWarningTone(warning) === "caution");
  const salesMixUnallocatedSqm = Math.max(results.area.sellableSqm - results.salesMix.allocatedSqm, 0);
  const installmentPriceUplift = Math.max(
    results.pricing.installmentRecommendedPricePerSqm - results.pricing.outrightRecommendedPricePerSqm,
    0,
  );
  const pricingNarrative =
    form.saleMode === "PER_SQM"
      ? results.revenue.effectiveSellingPricePerSqm >= results.revenue.breakevenPricePerSqm
        ? "Current market pricing is above break-even and supports the modelled delivery cost base."
        : "Current market pricing is below break-even, so the project needs a higher headline rate or leaner cost structure."
      : "Revenue is being driven by the structured sales mix rather than one flat land rate, so allocation quality matters directly.";
  const allocationNarrative =
    form.saleMode === "PER_SQM"
      ? "Per-sqm mode assumes the full sellable estate can clear at one defendable market rate."
      : salesMixUnallocatedSqm > 0
        ? `The commercial plan still leaves ${new Intl.NumberFormat("en-NG").format(salesMixUnallocatedSqm)} sqm unallocated, so projected revenue may be conservative until more inventory is mapped.`
        : "The commercial plan covers the sellable estate cleanly, so revenue output is grounded in defined products.";
  const marginNarrative =
    form.requiredTargetProfitMarginRate >= 35
      ? "Target margin is aggressive and may require strong market depth or a premium positioning story."
      : form.requiredTargetProfitMarginRate <= 15
        ? "Target margin is relatively conservative and may leave pricing headroom on the table if demand is stronger than expected."
        : "Target margin sits in a balanced range for management review and market testing.";
  const recommendationBundle = buildCalculatorRecommendations(form, results);

  return (
    <DashboardShell
      area="admin"
      title="Decision review"
      subtitle="Executive readout for pricing, profitability, timing pressure, and management-level recommendations."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              Executive decision screen
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">
              {form.projectName}
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
              Review the current saved model without editing controls competing for attention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/feasibility/${calculationId}`}>
              <Button variant="outline">Open workspace</Button>
            </Link>
            <Link href={`/admin/feasibility/${calculationId}/report`}>
              <Button variant="outline">Print / export</Button>
            </Link>
          </div>
        </div>

        {featureFlags.hasGeminiAi && (
          <div className="rounded-[30px] border border-[var(--line)] bg-white p-6">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">
                AI analysis
              </div>
              <h2 className="mt-3 text-xl font-semibold text-[var(--ink-950)]">
                Feasibility narrative
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
                Generate a plain-English executive summary of viability, key risks, and recommended action.
              </p>
            </div>
            <FeasibilityAiNarrative calculationId={calculationId} />
          </div>
        )}

        <InvestorReportView
          form={form}
          results={results}
          pricingNarrative={pricingNarrative}
          allocationNarrative={allocationNarrative}
          marginNarrative={marginNarrative}
          salesMixUnallocatedSqm={salesMixUnallocatedSqm}
          installmentPriceUplift={installmentPriceUplift}
          activeWarnings={activeWarnings}
          cautionWarnings={cautionWarnings}
          createdAt={detail.createdAt}
          updatedAt={detail.updatedAt}
          recommendationBundle={recommendationBundle}
        />
      </div>
    </DashboardShell>
  );
}
