"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import type { InvoiceSummary } from "@/modules/invoices/service";

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-[var(--success-50,#ecfdf5)] text-[var(--success-700,#15803d)]",
  SENT: "bg-[var(--brand-50,#ecfdf5)] text-[var(--brand-ink,#0e5b49)]",
  DRAFT: "bg-[var(--sand-100,#f1f5f9)] text-[var(--ink-600)]",
  VOID: "bg-[var(--danger-50,#fef2f2)] text-[var(--danger-700,#b91c1c)]",
};

/**
 * Invoice register (admin + buyer portal), migrated to the shared DataTable:
 * sortable columns, search, and pagination for long registers. Status badge
 * and the download link render as custom cells; the buyer column stays
 * conditional (hidden on the buyer's own portal via `showBuyer`).
 */
export function InvoiceList({
  invoices,
  showBuyer = true,
  emptyMessage = "No invoices yet.",
}: {
  invoices: InvoiceSummary[];
  showBuyer?: boolean;
  emptyMessage?: string;
}) {
  const columns = useMemo<ColumnDef<InvoiceSummary, unknown>[]>(() => {
    const defs: ColumnDef<InvoiceSummary, unknown>[] = [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice",
        cell: ({ row }) => (
          <span className="font-medium text-[var(--ink-950)]">{row.original.invoiceNumber}</span>
        ),
      },
    ];

    if (showBuyer) {
      defs.push({
        accessorKey: "buyerName",
        header: "Buyer",
        cell: ({ row }) => (
          <div>
            <div>{row.original.buyerName}</div>
            <div className="text-xs text-[var(--ink-400)]">{row.original.buyerEmail}</div>
          </div>
        ),
      });
    }

    defs.push(
      {
        accessorKey: "propertyTitle",
        header: "Property",
        cell: ({ row }) => (
          <span className="text-[var(--ink-600)]">{row.original.propertyTitle ?? "—"}</span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="numeric font-semibold text-[var(--ink-950)]">{row.original.total}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[row.original.status] ?? STATUS_STYLE.DRAFT}`}
          >
            {row.original.status}
          </span>
        ),
      },
      { accessorKey: "issuedAt", header: "Issued" },
      {
        id: "document",
        header: "Document",
        enableSorting: false,
        cell: ({ row }) => (
          <a
            href={`/api/invoices/${row.original.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-focus inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors hover:bg-[var(--sand-100,#f1f5f9)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            View / print
          </a>
        ),
      },
    );

    return defs;
  }, [showBuyer]);

  return (
    <DataTable
      columns={columns}
      data={invoices}
      searchPlaceholder={showBuyer ? "Search invoices by number, buyer, or property…" : undefined}
      pageSize={25}
      emptyTitle={emptyMessage}
    />
  );
}
