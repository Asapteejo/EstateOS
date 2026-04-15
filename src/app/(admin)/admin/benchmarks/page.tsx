import Link from "next/link";

import {
  AdminEmptyState,
  AdminMetricGrid,
  AdminMetricCard,
  AdminPanel,
  AdminStateBanner,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import {
  getBenchmarkReport,
  BENCHMARK_WINDOW_DAYS,
  type MetricBand,
  type PropertyTypeBenchmark,
} from "@/modules/benchmarks/aggregator";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number, unit: "pct" | "days" | "currency"): string {
  if (unit === "pct") return `${value.toFixed(1)}%`;
  if (unit === "days") return `${value.toFixed(1)}d`;
  return formatCurrency(value);
}

const POSITION_META: Record<
  MetricBand["positionLabel"],
  { label: string; tone: "success" | "info" | "warning" | "danger" }
> = {
  top_quartile:       { label: "Top quartile",    tone: "success"  },
  above_median:       { label: "Above median",    tone: "success"  },
  near_median:        { label: "Near median",     tone: "info"     },
  below_median:       { label: "Below median",    tone: "warning"  },
  low:                { label: "Low",             tone: "danger"   },
  insufficient_data:  { label: "Not enough data", tone: "info"     },
};

const TONE_CLASSES: Record<string, string> = {
  success: "border-[color:var(--success-200)] bg-[color:var(--success-50)] text-[var(--success-900)]",
  info:    "border-[var(--line)] bg-[var(--sand-50)] text-[var(--ink-600)]",
  warning: "border-[color:var(--warning-200)] bg-[color:var(--warning-50)] text-[var(--warning-900)]",
  danger:  "border-[color:var(--danger-200)] bg-[color:var(--danger-50)] text-[var(--danger-900)]",
};

// ─── Comparison bar ───────────────────────────────────────────────────────────
//
// Renders a horizontal band where:
//   - The shaded region = p25 → p75 (interquartile range)
//   - A thin tick = platform median
//   - A circle marker = tenant's value
//
// All positions are computed as percentages of (0 → maxValue * 1.2).

function BenchmarkBar({
  band,
  unit,
}: {
  band: MetricBand;
  unit: "pct" | "days" | "currency";
}) {
  const { tenantValue, platformP25, platformMedian, platformP75 } = band;

  // Scale: use enough headroom that the tenant marker is never clipped.
  const maxValue = Math.max(tenantValue * 1.1, platformP75 * 1.25, 1);
  const pct = (v: number) => `${Math.min(100, (v / maxValue) * 100).toFixed(2)}%`;

  const iqrLeft  = pct(platformP25);
  const iqrWidth = `${Math.min(100, ((platformP75 - platformP25) / maxValue) * 100).toFixed(2)}%`;
  const p50Left  = pct(platformMedian);
  const tenLeft  = pct(tenantValue);

  if (band.sampleSize < 3) {
    return (
      <p className="text-xs text-[var(--ink-400)]">
        Platform data unavailable — not enough agencies in distribution yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Track */}
      <div className="relative h-3 rounded-full bg-[var(--sand-100)]">
        {/* IQR band */}
        <div
          className="absolute h-full rounded-full bg-[var(--brand-100)]"
          style={{ left: iqrLeft, width: iqrWidth }}
          aria-hidden="true"
        />
        {/* Median tick */}
        <div
          className="absolute top-[-3px] h-[18px] w-[2px] rounded-full bg-[var(--ink-400)]"
          style={{ left: p50Left }}
          aria-label={`Platform median: ${fmt(platformMedian, unit)}`}
        />
        {/* Tenant marker */}
        <div
          className="absolute top-[-5px] h-[22px] w-[22px] -translate-x-1/2 rounded-full border-2 border-white bg-[var(--ink-950)] shadow-sm"
          style={{ left: tenLeft }}
          aria-label={`Your value: ${fmt(tenantValue, unit)}`}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between text-[10px] text-[var(--ink-400)]">
        <span>
          P25 {fmt(platformP25, unit)}
        </span>
        <span className="font-medium text-[var(--ink-600)]">
          Median {fmt(platformMedian, unit)}
        </span>
        <span>
          P75 {fmt(platformP75, unit)}
        </span>
      </div>
    </div>
  );
}

// ─── Metric comparison card ───────────────────────────────────────────────────

function MetricComparisonPanel({
  title,
  description,
  band,
  unit,
  tenantLabel,
  platformLabel,
  lowerIsBetter,
}: {
  title: string;
  description: string;
  band: MetricBand;
  unit: "pct" | "days" | "currency";
  tenantLabel?: string;
  platformLabel?: string;
  lowerIsBetter?: boolean;
}) {
  const meta = POSITION_META[band.positionLabel];
  void lowerIsBetter; // surfaced via band.isLowerBetter

  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
            {title}
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{description}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${TONE_CLASSES[meta.tone]}`}
        >
          {meta.label}
        </span>
      </div>

      {/* Values */}
      <div className="mt-5 flex items-end gap-8">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
            {tenantLabel ?? "Your agency"}
          </div>
          <div className="mt-1 font-serif text-3xl font-semibold tracking-[-0.02em] text-[var(--ink-950)]">
            {fmt(band.tenantValue, unit)}
          </div>
        </div>
        <div className="pb-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
            {platformLabel ?? "Platform median"}
          </div>
          <div className="mt-1 text-xl font-semibold text-[var(--ink-500)]">
            {fmt(band.platformMedian, unit)}
          </div>
        </div>
        <div className="ml-auto pb-1 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
            Percentile
          </div>
          <div className="mt-1 text-xl font-semibold text-[var(--ink-500)]">
            {band.sampleSize >= 3 ? `${band.tenantPercentileRank}th` : "—"}
          </div>
        </div>
      </div>

      {/* Band */}
      <div className="mt-6">
        <BenchmarkBar band={band} unit={unit} />
      </div>

      {/* Footer: sample note */}
      {band.sampleSize >= 3 && (
        <p className="mt-3 text-[10px] text-[var(--ink-400)]">
          Based on {band.sampleSize} anonymised{" "}
          {band.sampleSize === 1 ? "agency" : "agencies"} with sufficient data.
        </p>
      )}
    </div>
  );
}

// ─── Property type table ──────────────────────────────────────────────────────

function PropertyTypeTable({ rows }: { rows: PropertyTypeBenchmark[] }) {
  if (rows.length === 0) {
    return (
      <AdminEmptyState
        title="No deal data yet"
        description="Deal transactions will appear here once they are created and linked to properties."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            {[
              "Property type",
              "Deals",
              "Completed",
              "Completion rate",
              "Revenue",
              "Platform share",
            ].map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.type}>
              <td>
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="rounded-full bg-[var(--ink-950)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                      #1
                    </span>
                  )}
                  <span className="font-medium capitalize text-[var(--ink-950)]">
                    {row.type.replaceAll("_", " ").toLowerCase()}
                  </span>
                </div>
              </td>
              <td>{row.tenantDealCount}</td>
              <td>{row.tenantCompletedDeals}</td>
              <td>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${
                      row.tenantCompletionRate >= 50
                        ? "text-[var(--success-700)]"
                        : row.tenantCompletionRate > 0
                          ? "text-[var(--warning-700)]"
                          : "text-[var(--ink-400)]"
                    }`}
                  >
                    {row.tenantCompletionRate.toFixed(0)}%
                  </span>
                  {/* Mini progress bar */}
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--sand-100)]">
                    <div
                      className="h-full rounded-full bg-[var(--ink-400)]"
                      style={{ width: `${Math.min(100, row.tenantCompletionRate)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="font-medium text-[var(--ink-950)]">
                {formatCurrency(row.tenantRevenue)}
              </td>
              <td>
                <div className="flex items-center gap-2 text-[var(--ink-500)]">
                  <span>{row.platformTypeShare.toFixed(1)}%</span>
                  {/* Tiny bar for platform share */}
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--sand-100)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand-300)]"
                      style={{ width: `${Math.min(100, row.platformTypeShare)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--ink-400)]">of platform</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminBenchmarksPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const report = await getBenchmarkReport(tenant.companyId!);

  if (!report) {
    return (
      <DashboardShell
        area="admin"
        title="Benchmarks"
        subtitle="Compare your performance against anonymised platform averages."
      >
        <AdminEmptyState
          title="Database not connected"
          description="Benchmarking requires a live database connection. Configure the DATABASE_URL environment variable to enable this feature."
        />
      </DashboardShell>
    );
  }

  // Summary overview metrics
  const summaryMetrics = [
    {
      label: "Inquiry → reservation",
      value: `${report.inquiryToReservation.tenantValue.toFixed(1)}%`,
      hint: `Platform median: ${report.inquiryToReservation.platformMedian.toFixed(1)}%`,
      tone:
        report.inquiryToReservation.positionLabel === "top_quartile" ||
        report.inquiryToReservation.positionLabel === "above_median"
          ? ("success" as const)
          : report.inquiryToReservation.positionLabel === "below_median" ||
              report.inquiryToReservation.positionLabel === "low"
            ? ("danger" as const)
            : ("default" as const),
    },
    {
      label: "Avg deal velocity",
      value: `${report.dealVelocity.tenantValue.toFixed(0)} days`,
      hint: `Platform median: ${report.dealVelocity.platformMedian.toFixed(0)} days`,
      tone:
        report.dealVelocity.positionLabel === "top_quartile" ||
        report.dealVelocity.positionLabel === "above_median"
          ? ("success" as const)
          : report.dealVelocity.positionLabel === "below_median" ||
              report.dealVelocity.positionLabel === "low"
            ? ("danger" as const)
            : ("default" as const),
    },
    {
      label: "Payment default rate",
      value: `${report.paymentDefaultRate.tenantValue.toFixed(1)}%`,
      hint: `Platform median: ${report.paymentDefaultRate.platformMedian.toFixed(1)}%`,
      tone:
        report.paymentDefaultRate.positionLabel === "top_quartile" ||
        report.paymentDefaultRate.positionLabel === "above_median"
          ? ("success" as const)
          : report.paymentDefaultRate.positionLabel === "below_median" ||
              report.paymentDefaultRate.positionLabel === "low"
            ? ("danger" as const)
            : ("default" as const),
    },
    {
      label: "Top property type",
      value:
        report.topPropertyTypes[0]?.type
          ? report.topPropertyTypes[0].type.replaceAll("_", " ").toLowerCase()
          : "—",
      hint:
        report.topPropertyTypes[0]
          ? `${report.topPropertyTypes[0].tenantDealCount} deal${report.topPropertyTypes[0].tenantDealCount === 1 ? "" : "s"} · ${formatCurrency(report.topPropertyTypes[0].tenantRevenue)} revenue`
          : "No deal data yet",
    },
  ];

  return (
    <DashboardShell
      area="admin"
      title="Performance benchmarks"
      subtitle={`How your agency compares to anonymised platform averages — ${BENCHMARK_WINDOW_DAYS}-day rolling window.`}
    >
      {/* Anonymisation notice */}
      <AdminStateBanner
        tone="info"
        title="Anonymised platform data"
        message={`Platform distributions are derived from all EstateOS agencies with sufficient activity. No individual company is identifiable. Only agencies with a minimum transaction threshold are included. Benchmarks update in real time.`}
      />

      {/* Overview row */}
      <AdminMetricGrid>
        {summaryMetrics.map((m) => (
          <AdminMetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            hint={m.hint}
            tone={m.tone ?? "default"}
          />
        ))}
      </AdminMetricGrid>

      {/* Detailed comparisons */}
      <AdminPanel
        title="Metric deep-dives"
        description="Each card shows your value, the platform median, and an interquartile band (shaded = p25 → p75). The filled circle is your position."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <MetricComparisonPanel
            title="Inquiry → reservation conversion"
            description="Reservations created divided by inquiries received in the last 90 days."
            band={report.inquiryToReservation}
            unit="pct"
            tenantLabel="Your rate"
            platformLabel="Platform median"
          />
          <MetricComparisonPanel
            title="Average deal velocity"
            description="Mean days from deal creation to FINAL_PAYMENT_COMPLETED or HANDOVER_COMPLETED."
            band={report.dealVelocity}
            unit="days"
            tenantLabel="Your avg"
            platformLabel="Platform median"
            lowerIsBetter
          />
          <MetricComparisonPanel
            title="Payment default rate"
            description="Percentage of active transactions currently marked OVERDUE."
            band={report.paymentDefaultRate}
            unit="pct"
            tenantLabel="Your rate"
            platformLabel="Platform median"
            lowerIsBetter
          />
          {/* Conversion synopsis */}
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] px-6 py-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              Benchmark interpretation
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--ink-600)]">
              <li className="flex gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--ink-950)]" />
                <span>
                  <strong className="text-[var(--ink-900)]">Conversion rate</strong> — above
                  the median means your team qualifies and closes buyer interest more
                  effectively than most.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--ink-950)]" />
                <span>
                  <strong className="text-[var(--ink-900)]">Deal velocity</strong> — lower
                  is better. Faster closures reduce buyer drop-off risk and improve cash
                  collection.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--ink-950)]" />
                <span>
                  <strong className="text-[var(--ink-900)]">Default rate</strong> — lower
                  is better. A high default rate signals collection problems or over-stretched
                  buyers.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-300)]" />
                <span>
                  The shaded bar is the <strong className="text-[var(--ink-900)]">
                  interquartile range</strong> — the middle 50% of all agencies. Being
                  inside the band is normal; above p75 is strong performance.
                </span>
              </li>
            </ul>
            <div className="mt-6 space-y-2">
              <Link href="/admin/analytics">
                <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-50)]">
                  View detailed analytics →
                </div>
              </Link>
              <Link href="/admin/payments">
                <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-50)]">
                  Manage overdue payments →
                </div>
              </Link>
            </div>
          </div>
        </div>
      </AdminPanel>

      {/* Property type breakdown */}
      <AdminPanel
        title="Top performing property types"
        description="Ranked by revenue from successful payments. Platform share shows what fraction of all EstateOS listings belong to each category."
        className="px-0 py-0"
      >
        <PropertyTypeTable rows={report.topPropertyTypes} />
      </AdminPanel>

      {/* Benchmark context footer */}
      <AdminToolbar>
        <p className="text-sm text-[var(--ink-500)]">
          Benchmarks use a rolling {BENCHMARK_WINDOW_DAYS}-day window for conversion
          and velocity metrics. Default rate reflects current live deal status.
          Platform distributions exclude companies below the minimum activity threshold to
          ensure fair comparisons.
        </p>
      </AdminToolbar>
    </DashboardShell>
  );
}
