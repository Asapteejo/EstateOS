import Link from "next/link";

import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
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
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/admin/analytics?range=${option.value}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              option.value === range
                ? "bg-[var(--ink-950)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--ink-700)] hover:bg-[var(--sand-50)]"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
            Total collected
          </div>
          <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">
            {formatAnalyticsCurrency(analytics.summary.totalCollected)}
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
            Successful payments recorded across the workspace.
          </p>
        </Card>
        <Card className="p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
            Outstanding balance
          </div>
          <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">
            {formatAnalyticsCurrency(analytics.summary.totalOutstanding)}
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
            Open deal value that still needs collection.
          </p>
        </Card>
        <Card className="p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
            Inquiry → reservation
          </div>
          <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">
            {analytics.funnel.inquiryToReservationConversion.toFixed(1)}%
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
            {analytics.funnel.reservationCount} reservations from {analytics.funnel.inquiryCount} tracked inquiries.
          </p>
        </Card>
        <Card className="p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
            Collections efficiency
          </div>
          <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">
            {analytics.collections.overdueRecoveredPercent.toFixed(1)}%
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
            Overdue value recovered in the current analytics snapshot.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Historical trend</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Daily and grouped analytics snapshots keep revenue and collections visible over time.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--sand-100)] text-left text-[var(--ink-500)]">
                <tr>
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium">Deals</th>
                  <th className="px-6 py-3 font-medium">Requests</th>
                  <th className="px-6 py-3 font-medium">Collected</th>
                  <th className="px-6 py-3 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {analytics.trendSeries.map((item: (typeof analytics.trendSeries)[number]) => (
                  <tr key={item.label}>
                    <td className="px-6 py-4 font-medium text-[var(--ink-950)]">{item.label}</td>
                    <td className="px-6 py-4 text-[var(--ink-700)]">{item.totalDeals}</td>
                    <td className="px-6 py-4 text-[var(--ink-700)]">{item.paymentRequests}</td>
                    <td className="px-6 py-4 text-[var(--ink-700)]">{formatAnalyticsCurrency(item.collected)}</td>
                    <td className="px-6 py-4 text-[var(--danger-700)]">{formatAnalyticsCurrency(item.overdueAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Collections performance</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">
            Use this block to understand whether the team is clearing risk fast enough.
          </p>
          <div className="mt-6 space-y-5">
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Overdue amount
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--danger-700)]">
                {formatAnalyticsCurrency(analytics.summary.overdueAmount)}
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">
                {analytics.summary.overdueCount} deals currently need collections attention.
              </p>
            </div>
            <div className="rounded-[22px] border border-[var(--line)] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Avg days to collect
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                {analytics.collections.avgDaysToCollect.toFixed(1)} days
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">
                Based on paid reservations captured in the daily analytics snapshots.
              </p>
            </div>
            <div className="rounded-[22px] border border-[var(--line)] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Reservation → payment
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                {analytics.funnel.reservationToPaymentConversion.toFixed(1)}%
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">
                Shows how reliably reservations are turning into successful payments.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
