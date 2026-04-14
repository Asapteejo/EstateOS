import Link from "next/link";

import { AdminMetricCard, AdminMetricGrid, AdminPanel } from "@/components/admin/admin-ui";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import {
  formatAnalyticsCurrency,
  getCompanyAnalyticsReport,
  parseAnalyticsRange,
  type AnalyticsRange,
} from "@/modules/analytics/aggregates";

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession();
  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const range = parseAnalyticsRange(resolvedSearchParams.range);
  const analytics = await getCompanyAnalyticsReport(tenant, range);

  return (
    <DashboardShell
      area="admin"
      title="Company analytics"
      subtitle="Track conversion, collections efficiency, and how fast your team turns buyer interest into cash."
    >
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-1.5 rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)]/90 p-1.5 sm:min-w-0">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/admin/analytics?range=${option.value}`}
              className={
                option.value === range
                  ? "rounded-[14px] bg-white px-3.5 py-2 text-sm font-medium text-[var(--ink-950)] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                  : "rounded-[14px] px-3.5 py-2 text-sm font-medium text-[var(--ink-500)] transition hover:text-[var(--ink-900)]"
              }
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <AdminMetricGrid>
        <AdminMetricCard
          label="Total collected"
          value={formatAnalyticsCurrency(analytics.summary.totalCollected)}
          hint="Successful payments recorded across the workspace."
        />
        <AdminMetricCard
          label="Outstanding balance"
          value={formatAnalyticsCurrency(analytics.summary.totalOutstanding)}
          hint="Open deal value that still needs collection."
        />
        <AdminMetricCard
          label="Inquiry -> reservation"
          value={`${analytics.funnel.inquiryToReservationConversion.toFixed(1)}%`}
          hint={`${analytics.funnel.reservationCount} reservations from ${analytics.funnel.inquiryCount} tracked inquiries.`}
        />
        <AdminMetricCard
          label="Collections efficiency"
          value={`${analytics.collections.overdueRecoveredPercent.toFixed(1)}%`}
          hint="Overdue value recovered in the current analytics snapshot."
          tone={analytics.collections.overdueRecoveredPercent >= 50 ? "success" : "default"}
        />
      </AdminMetricGrid>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel
          title="Historical trend"
          description="Daily and grouped analytics snapshots keep revenue and collections visible over time."
          className="px-0 py-0"
        >
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Deals</th>
                  <th>Requests</th>
                  <th>Collected</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.trendSeries.map((item: (typeof analytics.trendSeries)[number]) => (
                  <tr key={item.label}>
                    <td className="font-medium text-[var(--ink-950)]">{item.label}</td>
                    <td>{item.totalDeals}</td>
                    <td>{item.paymentRequests}</td>
                    <td>{formatAnalyticsCurrency(item.collected)}</td>
                    <td className="text-[var(--danger-700)]">{formatAnalyticsCurrency(item.overdueAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Collections performance"
          description="Use this block to understand whether the team is clearing risk fast enough."
        >
          <div className="space-y-4">
            <div className="rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                Overdue amount
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--danger-700)]">
                {formatAnalyticsCurrency(analytics.summary.overdueAmount)}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
                {analytics.summary.overdueCount} deals currently need collections attention.
              </p>
            </div>
            <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                Avg days to collect
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                {analytics.collections.avgDaysToCollect.toFixed(1)} days
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
                Based on paid reservations captured in the daily analytics snapshots.
              </p>
            </div>
            <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                Reservation {"->"} payment
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                {analytics.funnel.reservationToPaymentConversion.toFixed(1)}%
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
                Shows how reliably reservations are turning into successful payments.
              </p>
            </div>
          </div>
        </AdminPanel>
      </div>
    </DashboardShell>
  );
}
