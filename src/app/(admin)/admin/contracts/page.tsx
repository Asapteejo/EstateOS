import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { featureFlags } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { AdminMetricCard, AdminMetricGrid, AdminToolbar } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import {
  buildContractSettingsReadiness,
  getAdminContractRows,
  getAdminGeneratedContracts,
  getCompanyContractSettings,
  getTransactionsWithoutContract,
  type GeneratedContractRow,
  type SignedAgreementRow,
  type TransactionWithoutContract,
} from "@/modules/contracts/service";
import { generateContractSubmitAction, sendContractAction, uploadContractAction } from "./actions";
import { GenerateContractForm } from "./generate-contract-form";
import {
  GeneratedContractsTable,
  UploadedContractsTable,
} from "@/components/admin/contracts-tables";
import { Select } from "@/components/ui/select";

// ─── Row flattening for the client tables ─────────────────────────────────────
// The client DataTable needs serializable rows; dates are formatted here on
// the server so the table only ever sees display strings.

function toUploadedContractRow(row: SignedAgreementRow) {
  return {
    id: row.id,
    reference: row.transaction.reservation?.reference ?? row.transactionId.slice(0, 8),
    buyer:
      [row.transaction.user.firstName, row.transaction.user.lastName].filter(Boolean).join(" ") ||
      "Buyer",
    property: row.transaction.property.title,
    fileName: row.document.fileName,
    status: row.status,
    dateLabel: row.acceptedAt
      ? formatDate(row.acceptedAt, "PP p")
      : row.sentAt
        ? formatDate(row.sentAt, "PP")
        : formatDate(row.createdAt, "PP"),
    acceptedNote:
      row.status === "COMPLETED"
        ? `Accepted ${row.acceptedByIp ? `· ${row.acceptedByIp}` : ""}`.trim()
        : null,
  };
}

function toGeneratedContractRow(row: GeneratedContractRow) {
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    buyer:
      [row.buyer.firstName, row.buyer.lastName].filter(Boolean).join(" ") ||
      row.buyer.email ||
      "Buyer",
    property: row.property?.title ?? "Unlinked",
    status: row.status,
    versionLabel: `v${row.version} - ${formatDate(row.generatedAt, "PP")}`,
    templateNote: row.templateVersion ? `Template v${row.templateVersion}` : null,
    documentId: row.documentId,
    transactionId: row.transactionId,
    templateId: row.templateId,
    canRegenerate: row.status !== "REGENERATED",
  };
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
          <Select
            name="transactionId"
            required className="w-full"
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
          </Select>
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
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/contracts"));

  const [contracts, generatedContracts, unlinked, contractSettings] = featureFlags.hasDatabase
    ? await Promise.all([
        getAdminContractRows(tenant.companyId!),
        getAdminGeneratedContracts(tenant.companyId!),
        getTransactionsWithoutContract(tenant.companyId!),
        getCompanyContractSettings(tenant),
      ])
    : [[], [], [], null];
  const contractReadiness = contractSettings?.readiness ?? buildContractSettingsReadiness({});
  const generationOptions = unlinked.map((tx) => {
    const ref = tx.reservation?.reference ?? tx.id.slice(0, 8);
    const buyer = [tx.user.firstName, tx.user.lastName].filter(Boolean).join(" ") || "Buyer";
    return {
      id: tx.id,
      label: `${ref} - ${buyer} - ${tx.property.title}`,
    };
  });

  const pending   = contracts.filter((c) => c.status === "PENDING").length + generatedContracts.filter((c) => c.status === "PENDING_REVIEW").length;
  const sent      = contracts.filter((c) => c.status === "ACTIVE").length + generatedContracts.filter((c) => c.status === "ACTIVE").length;
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
        <AdminMetricCard label="Total contracts"  value={contracts.length + generatedContracts.length} hint="Uploaded and generated agreements linked to transactions." />
        <AdminMetricCard label="Uploaded"         value={pending}   hint="Uploaded but not yet sent to buyer." />
        <AdminMetricCard label="Sent to buyer"    value={sent}      hint="Buyer has been notified and can accept." tone={sent > 0 ? "accent" : "default"} />
        <AdminMetricCard label="Accepted"         value={accepted}  hint="Buyer accepted in portal." tone={accepted > 0 ? "success" : "default"} />
      </AdminMetricGrid>

      <GenerateContractForm transactions={generationOptions} readiness={contractReadiness} />
      <UploadContractForm transactions={unlinked} />

      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--ink-900)]">Generated Contracts of Sale</h2>
        </div>
        <GeneratedContractsTable
          rows={generatedContracts.map(toGeneratedContractRow)}
          generateAction={generateContractSubmitAction}
        />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--ink-900)]">All contracts</h2>
        </div>
        <UploadedContractsTable
          rows={contracts.map(toUploadedContractRow)}
          sendAction={sendContractAction}
        />
      </div>
    </DashboardShell>
  );
}
