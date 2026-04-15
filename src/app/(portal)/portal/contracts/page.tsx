import { requirePortalSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Button } from "@/components/ui/button";
import { getBuyerContracts, type BuyerContractRow } from "@/modules/contracts/service";
import { acceptContractAction } from "./actions";

// ─── Status label ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: BuyerContractRow["status"] }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Accepted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Awaiting your acceptance
    </span>
  );
}

// ─── Single contract card ─────────────────────────────────────────────────────

function ContractCard({ contract }: { contract: BuyerContractRow }) {
  const ref =
    contract.transaction.reservation?.reference ?? contract.transactionId.slice(0, 8);
  const isAccepted = contract.status === "COMPLETED";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
            {contract.transaction.property.title}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-[var(--ink-900)]">
            Agreement · {ref}
          </h2>
        </div>
        <StatusPill status={contract.status} />
      </div>

      {/* Document info */}
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3">
        <svg
          className="h-8 w-8 shrink-0 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--ink-800)]">
            {contract.document.fileName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-500)]">
            Sent {contract.sentAt ? formatDate(contract.sentAt, "PP") : "—"}
          </p>
        </div>
        <a
          href={contract.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] hover:bg-[var(--sand-100)] transition-colors"
        >
          View PDF
        </a>
      </div>

      {/* Acceptance section */}
      {isAccepted ? (
        <div className="mt-4 rounded-[var(--radius-md)] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-medium">You accepted this agreement.</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {contract.acceptedAt ? formatDate(contract.acceptedAt, "PPP p") : ""}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-[var(--ink-600)]">
            Please read the agreement carefully before accepting. By clicking{" "}
            <strong>Accept agreement</strong> you confirm that you have reviewed the document
            and agree to its terms. Your acceptance will be recorded with the current timestamp
            and your IP address.
          </p>
          <form action={acceptContractAction}>
            <input type="hidden" name="signedAgreementId" value={contract.id} />
            <Button type="submit" variant="default">
              Accept agreement
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PortalContractsPage() {
  const tenant = await requirePortalSession({ redirectOnMissingAuth: false });

  const contracts =
    featureFlags.hasDatabase && tenant.userId && tenant.companyId
      ? await getBuyerContracts(tenant.userId, tenant.companyId)
      : [];

  const pendingCount = contracts.filter((c) => c.status !== "COMPLETED").length;

  return (
    <DashboardShell
      area="portal"
      title="Contracts"
      subtitle="Review and accept your property agreements. Your acceptance is securely recorded."
    >
      {pendingCount > 0 && (
        <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have{" "}
          <strong>
            {pendingCount} agreement{pendingCount > 1 ? "s" : ""}
          </strong>{" "}
          awaiting your acceptance.
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-[var(--ink-700)]">No contracts yet</p>
          <p className="mt-1 text-sm text-[var(--ink-400)]">
            Your company will send agreements here when they are ready for your review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
