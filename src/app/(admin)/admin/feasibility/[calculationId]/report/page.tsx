import { notFound } from "next/navigation";

import { AutoPrintOnLoad } from "@/components/admin/auto-print-on-load";
import { InvestorReportView } from "@/components/admin/development-calculator-workspace";
import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { calculateDevelopmentFeasibility } from "@/modules/development-calculations/engine";
import {
  buildCalculatorRecommendations,
  generateFeasibilityNarrative,
} from "@/modules/development-calculations/recommendations";
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

export default async function AdminFeasibilityReportPage({
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

  let aiNarrative: string | null = null;
  if (featureFlags.hasGeminiAi) {
    try {
      const stream = await generateFeasibilityNarrative(tenant, calculationId);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
      }
      aiNarrative = chunks.join("");
    } catch {
      // non-critical — omit from report if generation fails
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <AutoPrintOnLoad title={`${form.projectName} Feasibility Report`} />
      <div className="mb-6 print:hidden">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
          Feasibility report
        </div>
        <h1 className="mt-2 font-serif text-3xl text-[var(--ink-950)]">Investor-ready PDF export</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-600)]">
          This route renders the saved feasibility report without dashboard chrome so browser export stays clean and print-friendly.
        </p>
      </div>
      {aiNarrative && (
        <div className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-6 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
            AI feasibility narrative
          </div>
          {aiNarrative
            .split(/\n\n+/)
            .filter((p) => p.trim())
            .map((paragraph, i) => (
              <p key={i} className="text-sm leading-7 text-[var(--ink-700)]">
                {paragraph.trim()}
              </p>
            ))}
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
    </main>
  );
}
