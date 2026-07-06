"use client";

import { useMemo } from "react";
import Link from "next/link";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";

export type PaymentRegisterRow = {
  id: string;
  reference: string;
  buyer: string;
  marketer: string;
  paymentStatus: string;
  stage: string;
  outstandingBalance: string;
  nextDueAt: string;
  receiptId: string | null;
};

/**
 * Deal payment register for /admin/payments — the FINANCE team's daily
 * driver, migrated from a static bespoke table to the shared DataTable:
 * sortable columns, search across references/buyers/marketers, pagination
 * for long registers, and the receipt download link preserved as a cell.
 */
export function PaymentsRegisterTable({ rows }: { rows: PaymentRegisterRow[] }) {
  const columns = useMemo<ColumnDef<PaymentRegisterRow, unknown>[]>(
    () => [
      { accessorKey: "reference", header: "Reference" },
      { accessorKey: "buyer", header: "Buyer" },
      { accessorKey: "marketer", header: "Marketer" },
      { accessorKey: "paymentStatus", header: "Payment state" },
      { accessorKey: "stage", header: "Stage" },
      { accessorKey: "outstandingBalance", header: "Outstanding" },
      { accessorKey: "nextDueAt", header: "Next due" },
      {
        id: "receipt",
        header: "Receipt",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.receiptId ? (
            <Link
              href={`/api/receipts/${row.original.receiptId}/download`}
              className="admin-focus rounded-[var(--radius-sm)] font-medium text-[var(--brand-ink)] underline underline-offset-2 hover:text-[var(--brand-800)]"
            >
              Download
            </Link>
          ) : (
            <span className="text-[var(--ink-500)]">Pending</span>
          ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search by reference, buyer, or marketer…"
      pageSize={25}
      emptyTitle="No deals in the register yet"
      emptyDescription="Deals appear here once buyers start transacting."
      frameless
    />
  );
}
