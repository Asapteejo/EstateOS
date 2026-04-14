import Link from "next/link";

import { SuperadminActivityFeed } from "@/components/superadmin/superadmin-activity-feed";
import { SuperadminHealthBadge } from "@/components/superadmin/superadmin-health-badge";
import { SuperadminMetricCard } from "@/components/superadmin/superadmin-metric-card";
import { SuperadminRangeTabs } from "@/components/superadmin/superadmin-range-tabs";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getSuperadminOverviewData, parseSuperadminRange } from "@/modules/superadmin/queries";

export default async function SuperadminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const range = parseSuperadminRange(resolvedSearchParams.range);
  const dashboard = await getSuperadminOverviewData(range);

  return (
    <SuperadminShell
      title="Platform overview"
      subtitle="See the money moving through EstateOS, what the platform itself is earning, and which companies need attention right now."
      actions={<SuperadminRangeTabs pathname="/superadmin" current={range} />}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.metrics.map((metric) => (
          <SuperadminMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            tone={
              metric.label.includes("Revenue") || metric.label.includes("inflow")
                ? "revenue"
                : metric.label.includes("overdue")
                  ? "risk"
                  : "default"
            }
          />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Actionable platform signals</h2>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            Click through to view affected companies and take action.
          </p>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
          <Link
            href={`/superadmin/companies?range=${range}&filter=payout-missing`}
            className="rounded-[24px] border border-[var(--line)] p-5 transition hover:border-[var(--brand-500)] hover:bg-[var(--sand-100)]"
          >
            <div className="text-sm text-[var(--ink-500)]">Missing payout setup</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink-950)]">{dashboard.actionBuckets.missingPayoutSetup}</div>
            <div className="mt-2 text-sm text-[var(--ink-600)]">Drill down to inspect provider readiness.</div>
          </Link>
          <Link
            href={`/superadmin/companies?range=${range}&filter=inactive&sort=most_active`}
            className="rounded-[24px] border border-[var(--line)] p-5 transition hover:border-[var(--brand-500)] hover:bg-[var(--sand-100)]"
          >
            <div className="text-sm text-[var(--ink-500)]">Inactive companies</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink-950)]">{dashboard.actionBuckets.inactiveCompanies}</div>
            <div className="mt-2 text-sm text-[var(--ink-600)]">Click to view affected companies and intervene.</div>
          </Link>
          <Link
            href={`/superadmin/companies?range=${range}&filter=collections-risk&sort=highest_overdue`}
            className="rounded-[24px] border border-rose-200 bg-rose-50/50 p-5 transition hover:border-rose-400 hover:bg-rose-50"
          >
            <div className="text-sm text-rose-700">Collections risk companies</div>
            <div className="mt-2 text-3xl font-semibold text-rose-700">{dashboard.actionBuckets.collectionsRiskCompanies}</div>
            <div className="mt-2 text-sm text-rose-700">Click to review overdue tenants and take action.</div>
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Top revenue companies</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Who is driving platform revenue and payment flow in {dashboard.range.label.toLowerCase()}.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {dashboard.topRevenueCompanies.map((company, index) => (
              <div key={company.companyId} className="grid gap-3 px-6 py-4 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
                <div className="text-sm font-semibold text-[var(--ink-400)]">#{index + 1}</div>
                <div>
                  <div className="font-semibold text-[var(--ink-950)]">
                    <Link href={`/superadmin/companies/${company.companyId}`} className="hover:underline">
                      {company.companyName}
                    </Link>
                  </div>
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

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Risk and underperformance</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Companies with overdue exposure, weak activity, or onboarding gaps.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {dashboard.riskCompanies.length ? (
              dashboard.riskCompanies.map((company) => (
                <div key={company.companyId} className="grid gap-3 px-6 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/superadmin/companies/${company.companyId}`}
                        className="font-semibold text-[var(--ink-950)] hover:underline"
                      >
                        {company.companyName}
                      </Link>
                      <SuperadminHealthBadge health={company.health} />
                    </div>
                    <div className="mt-2 text-sm text-[var(--ink-600)]">{company.healthReason}</div>
                    <div className="mt-2 text-sm text-[var(--ink-500)]">
                      Overdue {company.overdueFormatted}  -  Last active {company.lastActiveLabel}
                    </div>
                  </div>
                  <div className="text-right text-sm text-[var(--ink-500)]">
                    <div className="font-semibold text-rose-700">{formatCurrency(company.overdueAmount)}</div>
                    <div className="mt-1">Open collections risk</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-10 text-sm text-[var(--ink-500)]">
                No platform-wide risk flags in this range. The current company base is operating cleanly.
              </div>
            )}
          </div>
        </Card>
      </div>

      <SuperadminActivityFeed
        title="Platform inflow and activity"
        subtitle={`Last updated ${dashboard.generatedAtLabel}. Financial events are separated from platform-owner revenue inside the cards above.`}
        items={dashboard.recentActivity}
      />
    </SuperadminShell>
  );
}
