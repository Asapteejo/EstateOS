import Link from "next/link";

import { AdminEmptyState, AdminMetricCard, AdminMetricGrid, AdminPanel, AdminToolbar } from "@/components/admin/admin-ui";
import { OptimizedImage } from "@/components/media/optimized-image";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdminSession } from "@/lib/auth/guards";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getAdminMarketerPerformanceDashboard } from "@/modules/team/performance";

const SORT_OPTIONS = [
  ["score", "Score"],
  ["revenue", "Revenue"],
  ["deals", "Deals closed"],
  ["payments", "Payments"],
  ["reservations", "Reservations"],
  ["inspections", "Inspections"],
  ["rating", "Star rating"],
] as const;

const PERIOD_OPTIONS = [
  ["WEEKLY", "Weekly"],
  ["MONTHLY", "Monthly"],
  ["LIFETIME", "Lifetime"],
] as const;

function trendLabel(
  trend: {
    direction: "up" | "down" | "flat";
    scoreDelta: number;
    rankDelta: number;
    previousSnapshotDate: string;
  } | null,
) {
  if (!trend) {
    return "No prior snapshot";
  }

  if (trend.direction === "up") {
    return `Up since ${formatDate(trend.previousSnapshotDate)}`;
  }

  if (trend.direction === "down") {
    return `Down since ${formatDate(trend.previousSnapshotDate)}`;
  }

  return `Flat since ${formatDate(trend.previousSnapshotDate)}`;
}

export default async function AdminMarketersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const sortBy =
    typeof params.sort === "string" &&
    SORT_OPTIONS.some(([value]) => value === params.sort)
      ? (params.sort as (typeof SORT_OPTIONS)[number][0])
      : "score";
  const period =
    typeof params.period === "string" &&
    PERIOD_OPTIONS.some(([value]) => value === params.period)
      ? (params.period as (typeof PERIOD_OPTIONS)[number][0])
      : "MONTHLY";

  const dashboard = await getAdminMarketerPerformanceDashboard(tenant, {
    search,
    sortBy,
    period,
    now: new Date(),
  });

  const activeRows = dashboard.rows.filter((row) => row.isActive);
  const totalRevenue = dashboard.rows.reduce(
    (sum, row) => sum + row.revenue[dashboard.period.toLowerCase() as "weekly" | "monthly" | "lifetime"],
    0,
  );
  const averageScore =
    dashboard.rows.length > 0
      ? dashboard.rows.reduce((sum, row) => sum + row.score, 0) / dashboard.rows.length
      : 0;

  return (
    <DashboardShell
      area="admin"
      title="Marketer performance"
      subtitle="Tenant-scoped marketer analytics across ranking, successful payments, completed deals, inspections, reservations, and attributed revenue."
    >
      <AdminToolbar>
        <form method="GET" className="grid w-full gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
          <Input name="q" placeholder="Search marketer name or role" defaultValue={search} />
          <select
            name="period"
            defaultValue={period}
            className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          >
            {PERIOD_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sortBy}
            className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          >
            {SORT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                Sort by {label}
              </option>
            ))}
          </select>
          <Button type="submit">Apply</Button>
        </form>
      </AdminToolbar>

      <AdminMetricGrid>
        <AdminMetricCard
          label="Tracked marketers"
          value={dashboard.rows.length}
          hint={`${activeRows.length} active profile${activeRows.length === 1 ? "" : "s"} in this workspace.`}
        />
        <AdminMetricCard
          label={`${dashboard.period.toLowerCase()} revenue`}
          value={formatCurrency(totalRevenue)}
          hint="Attributed successful payment value across the selected period."
        />
        <AdminMetricCard
          label="Average score"
          value={averageScore.toFixed(1)}
          hint="Weighted performance score across the current ranked set."
        />
        <AdminMetricCard
          label="Latest snapshot"
          value={dashboard.latestSnapshotDate ? formatDate(dashboard.latestSnapshotDate, "PPP") : "Not captured yet"}
          hint="Daily ranking snapshots power trend direction and movement."
        />
      </AdminMetricGrid>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          title="Top performer"
          description="Best current operator based on the selected performance window."
        >
          {dashboard.topPerformer ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-18 w-18 overflow-hidden rounded-[20px] bg-[var(--sand-50)] sm:h-20 sm:w-20">
                {dashboard.topPerformer.avatarUrl ? (
                  <OptimizedImage
                    src={dashboard.topPerformer.avatarUrl}
                    alt={dashboard.topPerformer.fullName}
                    fill
                    preset="profile"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl font-semibold text-[var(--ink-400)]">
                    {dashboard.topPerformer.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--ink-950)]">
                  {dashboard.topPerformer.fullName}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-500)]">{dashboard.topPerformer.title}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--ink-600)]">{dashboard.topPerformer.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    Score {dashboard.topPerformer.score}
                  </span>
                  <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    Revenue {formatCurrency(dashboard.topPerformer.revenue[dashboard.period.toLowerCase() as "weekly" | "monthly" | "lifetime"])}
                  </span>
                  <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    Rating {dashboard.topPerformer.starRating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <AdminEmptyState
              title="No marketer activity yet"
              description="Performance ranking will appear once marketer-linked inspections, reservations, and successful payments are captured."
            />
          )}
        </AdminPanel>

        <AdminPanel
          title="Operator actions"
          description="Use staff settings and the public team page to keep marketer profiles current."
        >
          <div className="space-y-4">
            <div className="rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                Ranking note
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
                Ranking blends wishlist intent, qualified inquiries, inspections, reservations, successful payments, and completed deals into one operator score.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/team">
                <Button variant="outline">Manage team profiles</Button>
              </Link>
              <Link href="/team">
                <Button variant="outline">Open public team page</Button>
              </Link>
            </div>
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        title="Ranked marketer list"
        description={`${dashboard.rows.length} marketer${dashboard.rows.length === 1 ? "" : "s"} in this tenant workspace.`}
        className="px-0 py-0"
      >
        {dashboard.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Rank", "Marketer", "Score", "Stars", "Weekly revenue", "Monthly revenue", "Lifetime revenue", "Deals", "Payments", "Inspections", "Reservations", "Trend"].map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="font-semibold text-[var(--ink-950)]">#{row.rank}</td>
                    <td>
                      <div className="flex min-w-[220px] items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-[16px] bg-[var(--sand-50)]">
                          {row.avatarUrl ? (
                            <OptimizedImage src={row.avatarUrl} alt={row.fullName} fill preset="profile" className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-lg font-semibold text-[var(--ink-400)]">
                              {row.fullName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--ink-950)]">{row.fullName}</div>
                          <div className="text-[var(--ink-500)]">{row.title}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--ink-500)]">
                            {!row.isActive ? <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-2.5 py-1">Inactive</span> : null}
                            {!row.isPublished ? <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-2.5 py-1">Private</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="font-semibold text-[var(--ink-950)]">{row.score}</td>
                    <td>{row.starRating.toFixed(1)}</td>
                    <td>{formatCurrency(row.revenue.weekly)}</td>
                    <td>{formatCurrency(row.revenue.monthly)}</td>
                    <td>{formatCurrency(row.revenue.lifetime)}</td>
                    <td>{row.metrics.completedDeals}</td>
                    <td>{row.metrics.successfulPayments}</td>
                    <td>{row.metrics.inspectionsHandled}</td>
                    <td>{row.metrics.reservations}</td>
                    <td className="text-[var(--ink-600)]">{trendLabel(row.trend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-5">
            <AdminEmptyState
              title="No marketers matched this filter"
              description="Adjust search or period filters to bring marketers back into the ranking view."
            />
          </div>
        )}
      </AdminPanel>
    </DashboardShell>
  );
}
