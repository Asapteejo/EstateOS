import { Download } from "lucide-react";

import type { InvoiceSummary } from "@/modules/invoices/service";

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-[var(--success-50,#ecfdf5)] text-[var(--success-700,#15803d)]",
  SENT: "bg-[var(--brand-50,#ecfdf5)] text-[var(--brand-ink,#0e5b49)]",
  DRAFT: "bg-[var(--sand-100,#f1f5f9)] text-[var(--ink-600)]",
  VOID: "bg-[var(--danger-50,#fef2f2)] text-[var(--danger-700,#b91c1c)]",
};

export function InvoiceList({
  invoices,
  showBuyer = true,
  emptyMessage = "No invoices yet.",
}: {
  invoices: InvoiceSummary[];
  showBuyer?: boolean;
  emptyMessage?: string;
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-10 text-center shadow-[var(--shadow-sm)]">
        <p className="text-sm font-medium text-[var(--ink-700)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--sand-100,#f1f5f9)] text-xs uppercase tracking-wide text-[var(--ink-500)]">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              {showBuyer ? <th className="px-4 py-3 font-medium">Buyer</th> : null}
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="px-4 py-3 text-right font-medium">Document</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="text-[var(--ink-800)]">
                <td className="px-4 py-3 font-medium text-[var(--ink-950)]">{invoice.invoiceNumber}</td>
                {showBuyer ? (
                  <td className="px-4 py-3">
                    <div>{invoice.buyerName}</div>
                    <div className="text-xs text-[var(--ink-400)]">{invoice.buyerEmail}</div>
                  </td>
                ) : null}
                <td className="px-4 py-3 text-[var(--ink-600)]">{invoice.propertyTitle ?? "—"}</td>
                <td className="numeric px-4 py-3 text-right font-semibold text-[var(--ink-950)]">{invoice.total}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[invoice.status] ?? STATUS_STYLE.DRAFT}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--ink-500)]">{invoice.issuedAt}</td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/api/invoices/${invoice.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-focus inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors hover:bg-[var(--sand-100,#f1f5f9)]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    View / print
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
