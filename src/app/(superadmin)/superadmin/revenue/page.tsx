import Link from "next/link";

import { SuperadminMetricCard } from "@/components/superadmin/superadmin-metric-card";
import { SuperadminRangeTabs } from "@/components/superadmin/superadmin-range-tabs";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getPlatformAnalyticsReport } from "@/modules/analytics/aggregates";
import { getSuperadminRevenueData, parseSuperadminRange } from "@/modules/superadmin/queries";

export default async function SuperadminRevenuePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const range = parseSuperadminRange(resolvedSearchParams.range);
  const [revenue, platformAnalytics] = await Promise.all([
    getSuperadminRevenueData(range),
    getPlatformAnalyticsReport(range === "today" ? "7d" : range === "7d" ? "7d" : range === "30d" ? "30d" : "all"),
  ]);

  return (
    <SuperadminShell
      title="Revenue command center"
      subtitle="Separate money flowing through customer companies from money EstateOS actually earns."
      actions={<SuperadminRangeTabs pathname="/superadmin/revenue" current={range} />}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <SuperadminMetricCard
          label="EstateOS revenue"
          value={formatCurrency(revenue.summary.totalPlatformRevenue)}
          detail="Subscription + transaction revenue earned by the platform"
          tone="revenue"
        />
        <SuperadminMetricCard
          label="Subscription revenue"
          value={formatCurrency(revenue.summary.subscriptionRevenue)}
          detail="Recurring or granted-plan billing events"
          tone="revenue"
        />
        <SuperadminMetricCard
          label="Commission revenue"
          value={formatCurrency(revenue.summary.commissionRevenue)}
          detail="Fees taken from successful company payments"
          tone="revenue"
        />
        <SuperadminMetricCard
          label="Platform inflow"
          value={formatCurrency(revenue.summary.totalPlatformInflow)}
          detail="All successful money processed for companies"
          tone="default"
        />
        <SuperadminMetricCard
          label="Avg revenue / company"
          value={formatCurrency(revenue.summary.averageRevenuePerCompany)}
          detail="Blended EstateOS revenue per tenant in range"
          tone="default"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Revenue trends</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Near-live period buckets for platform inflow, EstateOS revenue, signups, and overdue exposure.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--sand-100)] text-left text-[var(--ink-500)]">
                <tr>
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium">Platform inflow</th>
                  <th className="px-6 py-3 font-medium">EstateOS revenue</th>
                  <th className="px-6 py-3 font-medium">Signups</th>
                  <th className="px-6 py-3 font-medium">Overdue exposure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {platformAnalytics.trendSeries.map((item) => (
                  <tr key={item.label}>
                    <td className="px-6 py-4 font-medium text-[var(--ink-950)]">{item.label}</td>
                    <td className="px-6 py-4 text-[var(--ink-700)]">{formatCurrency(item.inflow)}</td>
                    <td className="px-6 py-4 text-[var(--ink-700)]">{formatCurrency(item.platformRevenue)}</td>
                    <td className="px-6 py-4 text-[var(--ink-700)]">{item.newCompanies}</td>
                    <td className="px-6 py-4 text-[var(--ink-700)]">{formatCurrency(item.overdueAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Top revenue companies</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Companies generating the most value for the platform owner in this range.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {revenue.topRevenueCompanies.map((company) => (
              <div key={company.companyId} className="grid gap-3 px-6 py-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <Link href={`/superadmin/companies/${company.companyId}`} className="font-semibold text-[var(--ink-950)] hover:underline">
                    {company.companyName}
                  </Link>
                  <div className="mt-1 text-sm text-[var(--ink-500)]">{company.planLabel}</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div className="font-semibold text-[var(--ink-950)]">{company.platformRevenueFormatted}</div>
                  <div className="mt-1 text-[var(--ink-500)]">EstateOS revenue</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div className="font-semibold text-[var(--ink-950)]">{company.inflowFormatted}</div>
                  <div className="mt-1 text-[var(--ink-500)]">Platform inflow</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Revenue breakdown by company</h2>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            Last updated {revenue.generatedAtLabel}. Platform inflow and EstateOS revenue are intentionally shown side-by-side, not blended.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--sand-100)] text-left text-[var(--ink-500)]">
              <tr>
                <th className="px-6 py-3 font-medium">Company</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Platform inflow</th>
                <th className="px-6 py-3 font-medium">Subscription revenue</th>
                <th className="px-6 py-3 font-medium">Commission revenue</th>
                <th className="px-6 py-3 font-medium">EstateOS revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {revenue.companyBreakdown.map((company) => (
                <tr key={company.companyId}>
                  <td className="px-6 py-4">
                    <Link href={`/superadmin/companies/${company.companyId}`} className="font-semibold text-[var(--ink-950)] hover:underline">
                      {company.companyName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{company.planLabel}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{company.inflowFormatted}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{formatCurrency(company.subscriptionRevenue)}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{formatCurrency(company.commissionRevenue)}</td>
                  <td className="px-6 py-4 font-semibold text-[var(--ink-950)]">{company.platformRevenueFormatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </SuperadminShell>
  );
}
