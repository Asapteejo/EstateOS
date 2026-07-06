"use client";

import { useMemo } from "react";

import { Avatar } from "@/components/ui/avatar";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";

export type MarketerRankingRow = {
  id: string;
  rank: number;
  fullName: string;
  title: string;
  avatarUrl: string | null;
  isActive: boolean;
  isPublished: boolean;
  score: number;
  starRating: number;
  revenueWeekly: number;
  revenueMonthly: number;
  revenueLifetime: number;
  commissionTotal: number;
  commissionPending: number;
  completedDeals: number;
  successfulPayments: number;
  inspectionsHandled: number;
  reservations: number;
  trendLabel: string;
};

/**
 * Ranked marketer list for /admin/marketers, on the shared DataTable. Raw
 * numbers stay numbers (revenue, score, deals…) so column sorting is numeric
 * — the CEO can re-rank by monthly revenue or commission with one click —
 * while cells format for display. Default order is the service's rank.
 */
export function MarketerRankingTable({ rows }: { rows: MarketerRankingRow[] }) {
  const columns = useMemo<ColumnDef<MarketerRankingRow, unknown>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "Rank",
        cell: ({ row }) => (
          <span className="numeric font-semibold text-[var(--ink-950)]">#{row.original.rank}</span>
        ),
      },
      {
        accessorKey: "fullName",
        header: "Marketer",
        cell: ({ row }) => {
          const marketer = row.original;
          return (
            <div className="flex min-w-[220px] items-center gap-3">
              <Avatar
                name={marketer.fullName}
                imageUrl={marketer.avatarUrl}
                size="md"
                className="rounded-[16px] bg-[var(--sand-50)]"
              />
              <div>
                <div className="font-semibold text-[var(--ink-950)]">{marketer.fullName}</div>
                <div className="text-[var(--ink-500)]">{marketer.title}</div>
                {!marketer.isActive || !marketer.isPublished ? (
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--ink-500)]">
                    {!marketer.isActive ? (
                      <span className="rounded-full border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] px-2.5 py-1 whitespace-nowrap">
                        Inactive
                      </span>
                    ) : null}
                    {!marketer.isPublished ? (
                      <span className="rounded-full border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] px-2.5 py-1 whitespace-nowrap">
                        Private
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      numericColumn("score", "Score", (row) => String(row.score), "font-semibold text-[var(--ink-950)]"),
      numericColumn("starRating", "Stars", (row) => row.starRating.toFixed(1)),
      numericColumn("revenueWeekly", "Weekly revenue", (row) => formatCurrency(row.revenueWeekly)),
      numericColumn("revenueMonthly", "Monthly revenue", (row) => formatCurrency(row.revenueMonthly)),
      numericColumn("revenueLifetime", "Lifetime revenue", (row) => formatCurrency(row.revenueLifetime)),
      {
        accessorKey: "commissionTotal",
        header: "Commission earned",
        cell: ({ row }) => (
          <div>
            <div className="numeric font-medium text-[var(--ink-950)] whitespace-nowrap">
              {formatCurrency(row.original.commissionTotal)}
            </div>
            {row.original.commissionPending > 0 ? (
              <div className="numeric mt-0.5 text-xs text-[var(--ink-400)] whitespace-nowrap">
                {formatCurrency(row.original.commissionPending)} pending
              </div>
            ) : null}
          </div>
        ),
      },
      numericColumn("completedDeals", "Deals", (row) => String(row.completedDeals)),
      numericColumn("successfulPayments", "Payments", (row) => String(row.successfulPayments)),
      numericColumn("inspectionsHandled", "Inspections", (row) => String(row.inspectionsHandled)),
      numericColumn("reservations", "Reservations", (row) => String(row.reservations)),
      {
        accessorKey: "trendLabel",
        header: "Trend",
        cell: ({ row }) => (
          <span className="numeric text-[var(--ink-600)] whitespace-nowrap">
            {row.original.trendLabel}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search marketers…"
      pageSize={25}
      emptyTitle="No marketers matched this filter"
      emptyDescription="Adjust search or period filters to bring marketers back into the ranking view."
      frameless
    />
  );
}

function numericColumn(
  key: keyof MarketerRankingRow & string,
  header: string,
  render: (row: MarketerRankingRow) => string,
  extraClass = "",
): ColumnDef<MarketerRankingRow, unknown> {
  return {
    accessorKey: key,
    header,
    cell: ({ row }) => (
      <span className={`numeric whitespace-nowrap ${extraClass}`}>{render(row.original)}</span>
    ),
  };
}
