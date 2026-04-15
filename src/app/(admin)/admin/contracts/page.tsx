import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { AdminMetricCard, AdminMetricGrid, AdminToolbar } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import {
  getAdminContractRows,
  getTransactionsWithoutContract,
  type SignedAgreementRow,
  type TransactionWithoutContract,
} from "@/modules/contracts/service";
import { sendContractAction, uploadContractAction } from "./actions";

// ─── Status badge ─────────────────────────────────────────────────────────────

function ContractStatusBadge({ status }: { status: SignedAgreementRow["status"] }) {
  const map: Record<SignedAgreementRow["status"], { label: string; tone: string }> = {
    PENDING:   { label: "Uploaded",  tone: "bg-[var(--sand-100)] text-[var(--ink-600)]" },
    ACTIVE:    { label: "Sent",      tone: "bg-blue-50 text-blue-700" },
    COMPLETED: { label: "Accepted",  tone: "bg-emerald-50 text-emerald-700" },
    BLOCKED:   { label: "Blocked",   tone: "bg-red-50 text-red-700" },
  };
  const { label, tone } = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

// ─── Row: contract with actions ───────────────────────────────────────────────

function ContractRow({ row }: { row: SignedAgreementRow }) {
  const ref = row.transaction.reservation?.reference ?? row.transactionId.slice(0, 8);
  const buyer = [row.transaction.user.firstName, row.transaction.user.lastName]
    .filter(Boolean)
    .join(" ") || "Buyer";

  return (
    <tr className="border-b border-[var(--line)] last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-[var(--ink-900)]">{ref}</td>
      <td className="py-3 pr-4 text-sm text-[var(--ink-600)]">{buyer}</td>
      <td className="py-3 pr-4 text-sm text-[var(--ink-600)] max-w-[200px] truncate">
        {row.transaction.property.title}
      </td>
      <td className="py-3 pr-4 text-sm text-[var(--ink-600)]">{row.document.fileName}</td>
      <td className="py-3 pr-4">
        <ContractStatusBadge status={row.status} />
      </td>
      <td className="py-3 pr-4 text-sm text-[var(--ink-500)]">
        {row.acceptedAt
          ? formatDate(row.acceptedAt, "PP p")
          : row.sentAt
          ? formatDate(row.sentAt, "PP")
          : formatDate(row.createdAt, "PP")}
      </td>
      <td className="py-3 text-right">
        {row.status === "PENDING" && (
          <form action={sendContractAction}>
            <input type="hidden" name="signedAgreementId" value={row.id} />
            <Button type="submit" size="sm" variant="outline">
              Send to buyer
            </Button>
          </form>
        )}
        {row.status === "ACTIVE" && (
          <span className="text-xs text-[var(--ink-400)]">Awaiting acceptance</span>
        )}
        {row.status === "COMPLETED" && (
          <span className="text-xs text-emerald-600">
            Accepted {row.acceptedByIp ? `· ${row.acceptedByIp}` : ""}
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Upload form for a transaction without a contract ─────────────────────────

function UploadContractForm({ transactions }: { transactions: TransactionWithoutContract[] }) {
  if (transactions.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
      <h2 className="text-sm font-semibold text-[var(--ink-900)]">Upload contract</h2>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        Select a transaction, attach the signed PDF, then send it to the buyer when ready.
      </p>
      <form action={uploadContractAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-600)]">
            Transaction
          </label>
          <select
            name="transactionId"
            required
            className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          >
            <option value="">Select a transaction…</option>
            {transactions.map((tx) => {
              const ref = tx.reservation?.reference ?? tx.id.slice(0, 8);
              const buyer = [tx.user.firstName, tx.user.lastName].filter(Boolean).join(" ") || "Buyer";
              return (
                <option key={tx.id} value={tx.id}>
                  {ref} — {buyer} — {tx.property.title}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-600)]">
            Contract PDF
          </label>
          <input
            type="file"
            name="file"
            accept=".pdf,application/pdf"
            required
            className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-800)] file:mr-3 file:rounded file:border-0 file:bg-[var(--sand-100)] file:px-2 file:py-0.5 file:text-xs file:font-medium"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="default">
            Upload
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminContractsPage() {
  const tenant = await requireAdminSession();

  const [contracts, unlinked] = featureFlags.hasDatabase
    ? await Promise.all([
        getAdminContractRows(tenant.companyId!),
        getTransactionsWithoutContract(tenant.companyId!),
      ])
    : [[], []];

  const pending   = contracts.filter((c) => c.status === "PENDING").length;
  const sent      = contracts.filter((c) => c.status === "ACTIVE").length;
  const accepted  = contracts.filter((c) => c.status === "COMPLETED").length;

  return (
    <DashboardShell
      area="admin"
      title="Contracts"
      subtitle="Upload contract PDFs, send them to buyers, and track in-portal acceptance with timestamp and IP."
    >
      <AdminToolbar>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
            Contract management
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
            Contracts move from Uploaded → Sent → Accepted. Each stage is recorded in the audit log.
          </p>
        </div>
      </AdminToolbar>

      <AdminMetricGrid>
        <AdminMetricCard label="Total contracts"  value={contracts.length} hint="All agreements linked to transactions." />
        <AdminMetricCard label="Uploaded"         value={pending}   hint="Uploaded but not yet sent to buyer." />
        <AdminMetricCard label="Sent to buyer"    value={sent}      hint="Buyer has been notified and can accept." tone={sent > 0 ? "accent" : "default"} />
        <AdminMetricCard label="Accepted"         value={accepted}  hint="Buyer accepted in portal." tone={accepted > 0 ? "success" : "default"} />
      </AdminMetricGrid>

      <UploadContractForm transactions={unlinked} />

      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--ink-900)]">All contracts</h2>
        </div>
        {contracts.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--ink-400)]">
            No contracts uploaded yet. Use the form above to link a contract PDF to a transaction.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)] text-left">
                  {["Reference", "Buyer", "Property", "File", "Status", "Date", ""].map((h) => (
                    <th
                      key={h}
                      className="px-0 pb-3 pt-4 pr-4 first:pl-5 last:pr-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-400)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] [&>tr]:px-5">
                {contracts.map((row) => (
                  <ContractRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
