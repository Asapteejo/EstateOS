import Link from "next/link";

import { SuperadminCompanyStatusBadge } from "@/components/superadmin/superadmin-company-status-badge";
import { SuperadminHealthBadge } from "@/components/superadmin/superadmin-health-badge";
import { SuperadminRangeTabs } from "@/components/superadmin/superadmin-range-tabs";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getSuperadminCompaniesData, parseCompanySort, parseSuperadminRange } from "@/modules/superadmin/queries";

export default async function SuperadminCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const range = parseSuperadminRange(resolvedSearchParams.range);
  const sort = parseCompanySort(resolvedSearchParams.sort);
  const search = resolvedSearchParams.search ?? "";
  const health = resolvedSearchParams.health ?? "all";

  const dashboard = await getSuperadminCompaniesData({
    range,
    sort,
    search,
    health,
  });

  const buildHref = (next: { sort?: string; health?: string }) => {
    const params = new URLSearchParams();
    params.set("range", range);
    params.set("sort", next.sort ?? sort);
    params.set("health", next.health ?? health);
    if (search) {
      params.set("search", search);
    }
    return `/superadmin/companies?${params.toString()}`;
  };

  return (
    <SuperadminShell
      title="Company intelligence"
      subtitle="Search, filter, and rank tenants by revenue, collections risk, activation quality, and recent activity."
      actions={
        <div className="flex flex-col gap-3 xl:items-end">
          <SuperadminRangeTabs
            pathname="/superadmin/companies"
            current={range}
            extraParams={{ sort, health, search: search || null }}
          />
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">
            Updated {dashboard.generatedAtLabel}
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="p-5"><div className="text-sm text-[var(--ink-500)]">Healthy</div><div className="mt-2 text-2xl font-semibold">{dashboard.healthCounts.healthy}</div></Card>
        <Card className="p-5"><div className="text-sm text-[var(--ink-500)]">Collections risk</div><div className="mt-2 text-2xl font-semibold text-rose-700">{dashboard.healthCounts.collectionsRisk}</div></Card>
        <Card className="p-5"><div className="text-sm text-[var(--ink-500)]">Inactive</div><div className="mt-2 text-2xl font-semibold">{dashboard.healthCounts.inactive}</div></Card>
        <Card className="p-5"><div className="text-sm text-[var(--ink-500)]">Onboarding incomplete</div><div className="mt-2 text-2xl font-semibold">{dashboard.healthCounts.onboardingIncomplete}</div></Card>
        <Card className="p-5"><div className="text-sm text-[var(--ink-500)]">High value</div><div className="mt-2 text-2xl font-semibold text-[var(--brand-700)]">{dashboard.healthCounts.highValue}</div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Platform company table</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Use sort and health filters to find high-value tenants, collections risk, and dormant accounts quickly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={buildHref({ sort: "highest_revenue" })} className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-[var(--sand-100)]">Highest revenue</Link>
            <Link href={buildHref({ sort: "highest_overdue" })} className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-[var(--sand-100)]">Highest overdue</Link>
            <Link href={buildHref({ sort: "highest_inflow" })} className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-[var(--sand-100)]">Most inflow</Link>
            <Link href={buildHref({ sort: "most_active" })} className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-[var(--sand-100)]">Most active</Link>
            <Link href={buildHref({ health: "collections_risk" })} className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-[var(--sand-100)]">Collections risk</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--sand-100)] text-left text-[var(--ink-500)]">
              <tr>
                <th className="px-6 py-3 font-medium">Company</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Health</th>
                <th className="px-6 py-3 font-medium">Deals</th>
                <th className="px-6 py-3 font-medium">Payments collected</th>
                <th className="px-6 py-3 font-medium">Overdue</th>
                <th className="px-6 py-3 font-medium">EstateOS revenue</th>
                <th className="px-6 py-3 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {dashboard.rows.map((company) => (
                <tr key={company.companyId} className={company.companyStatus === "SUSPENDED" ? "bg-rose-50/40" : undefined}>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/superadmin/companies/${company.companyId}`} className="font-semibold text-[var(--ink-950)] hover:underline">
                        {company.companyName}
                      </Link>
                      <SuperadminCompanyStatusBadge status={company.companyStatus} />
                    </div>
                    <div className="mt-1 text-[var(--ink-500)]">{company.publicDomain}</div>
                  </td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">
                    <div>{company.planLabel}</div>
                    <div className="mt-1 text-[var(--ink-500)]">{company.subscriptionStatus}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <SuperadminHealthBadge health={company.health} />
                      <div className="max-w-[220px] text-xs text-[var(--ink-500)]">{company.healthReason}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{company.totalDeals}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{company.inflowFormatted}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{company.overdueFormatted}</td>
                  <td className="px-6 py-4 font-semibold text-[var(--ink-950)]">{company.platformRevenueFormatted}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{company.lastActiveLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </SuperadminShell>
  );
}
