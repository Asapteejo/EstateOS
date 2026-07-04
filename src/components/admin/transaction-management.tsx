"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminAttentionBadge, AdminEmptyState, AdminLifecycleSteps, AdminPanel, AdminQuickActions, AdminStateBanner } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { Textarea } from "@/components/ui/textarea";
import { compareAttentionPriority, getAttentionTone, workflowVocabulary } from "@/modules/admin/workflow-vocabulary";
import { formatCurrency } from "@/lib/utils";

type TransactionItem = {
  id: string;
  reservationId: string;
  reference: string;
  reservationStatus: string;
  property: string;
  buyer: string;
  buyerPhone: string | null;
  stage: string;
  balance: number;
};

const transactionStages = [
  "INQUIRY_RECEIVED",
  "KYC_SUBMITTED",
  "RESERVATION_FEE_PAID",
  "CONTRACT_ISSUED",
  "ALLOCATION_IN_PROGRESS",
  "LEGAL_VERIFICATION",
  "FINAL_PAYMENT_COMPLETED",
  "HANDOVER_COMPLETED",
];

const reservationStatuses = ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "CONVERTED"];

export function TransactionManagement({ items }: { items: TransactionItem[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, { reservationStatus: string; stage: string; notes: string }>>(
    Object.fromEntries(
      items.map((item) => [
        item.id,
        {
          reservationStatus: item.reservationStatus,
          stage: item.stage,
          notes: "",
        },
      ]),
    ),
  );
  const [pending, setPending] = useState<string | null>(null);

  async function saveItem(item: TransactionItem) {
    const draft = drafts[item.id];
    if (!draft) {
      return;
    }

    setPending(`${item.id}:reservation`);
    if (item.reservationId) {
      const response = await fetch(`/api/admin/reservations/${item.reservationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: draft.reservationStatus,
          notes: draft.notes || undefined,
        }),
      });

      if (!response.ok) {
        setPending(null);
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(json?.error ?? "Unable to update reservation.");
        return;
      }
    }

    const transactionResponse = await fetch(`/api/admin/transactions/${item.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: draft.stage,
        notes: draft.notes || undefined,
      }),
    });
    setPending(null);

    if (!transactionResponse.ok) {
      const json = (await transactionResponse.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update transaction.");
      return;
    }

    toast.success("Transaction updated.");
    router.refresh();
  }

  function resetItem(item: TransactionItem) {
    setDrafts((current) => ({
      ...current,
      [item.id]: {
        reservationStatus: item.reservationStatus,
        stage: item.stage,
        notes: "",
      },
    }));
  }

  function getAttentionState(item: TransactionItem) {
    return workflowVocabulary.transactions.attention({
      stage: drafts[item.id]?.stage ?? item.stage,
      balance: item.balance,
    });
  }

  const sortedItems = items
    .slice()
    .sort((left, right) =>
      compareAttentionPriority(
        getAttentionState(left)?.priority,
        getAttentionState(right)?.priority,
      ),
    );

  return (
    <AdminPanel
      title="Live transaction operations"
      description="Review transaction stages, reservation state, and outstanding balances without losing row context."
      className="overflow-hidden"
    >
      <div className="-mx-5 -my-5 divide-y divide-[var(--border-subtle,var(--line))]">
        {items.length > 0 ? (
          sortedItems.map((item) => {
            const attention = getAttentionState(item);
            const stage = drafts[item.id]?.stage ?? item.stage;
            const reservationStatus = drafts[item.id]?.reservationStatus ?? item.reservationStatus;

            return (
            <div key={item.id} className="grid min-w-0 gap-5 px-5 py-5 xl:grid-cols-[minmax(220px,1fr)_minmax(190px,0.72fr)_minmax(280px,1.1fr)_minmax(180px,auto)]">
              <div className="min-w-0">
                <div className="numeric break-words font-semibold text-[var(--ink-950)]">{item.reference}</div>
                <div className="mt-1 text-sm text-[var(--ink-500)]">
                  {item.property} - {item.buyer}
                </div>
                {item.buyerPhone ? (
                  <div className="mt-2">
                    <WhatsAppButton
                      phone={item.buyerPhone}
                      message={`Hi ${item.buyer}, regarding your transaction ${item.reference} for ${item.property}.`}
                    />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="whitespace-nowrap">
                    {workflowVocabulary.transactions.reservationStatusLabels[
                      reservationStatus as keyof typeof workflowVocabulary.transactions.reservationStatusLabels
                    ] ?? reservationStatus.toLowerCase()}
                  </Badge>
                  <Badge className="whitespace-nowrap">
                    {workflowVocabulary.transactions.stageLabels[
                      stage as keyof typeof workflowVocabulary.transactions.stageLabels
                    ] ?? stage.toLowerCase().replaceAll("_", " ")}
                  </Badge>
                  {attention ? (
                    <AdminAttentionBadge
                      label={attention.label}
                      tone={getAttentionTone(attention.priority)}
                    />
                  ) : null}
                </div>
                <div className="mt-4">
                  <AdminLifecycleSteps
                    compact
                    steps={workflowVocabulary.transactions.steps}
                    currentIndex={workflowVocabulary.transactions.lifecycleIndex(stage)}
                  />
                </div>
              </div>
              <div className="min-w-0 space-y-3 text-sm text-[var(--ink-700)]">
                <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] px-3 py-2.5">
                  <div className="text-eyebrow">Outstanding</div>
                  <div className="numeric mt-1 font-semibold text-[var(--ink-950)]">{formatCurrency(item.balance)}</div>
                </div>
                <select
                  className="admin-focus admin-interactive h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                  value={drafts[item.id]?.reservationStatus ?? item.reservationStatus}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: {
                        ...current[item.id],
                        reservationStatus: event.target.value,
                      },
                    }))
                  }
                  disabled={!item.reservationId || pending === `${item.id}:reservation`}
                >
                  {reservationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {workflowVocabulary.transactions.reservationStatusLabels[
                        status as keyof typeof workflowVocabulary.transactions.reservationStatusLabels
                      ] ?? status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 space-y-3">
                <select
                  className="admin-focus admin-interactive h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                  value={drafts[item.id]?.stage ?? item.stage}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: {
                        ...current[item.id],
                        stage: event.target.value,
                      },
                    }))
                  }
                  disabled={pending === `${item.id}:reservation`}
                >
                  {transactionStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {workflowVocabulary.transactions.stageLabels[
                        stage as keyof typeof workflowVocabulary.transactions.stageLabels
                      ] ?? stage.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <Textarea
                  placeholder="Operator note"
                  value={drafts[item.id]?.notes ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: {
                        ...current[item.id],
                        notes: event.target.value,
                      },
                    }))
                  }
                  className="min-h-24"
                />
                <AdminStateBanner
                  tone={
                    (drafts[item.id]?.reservationStatus ?? item.reservationStatus) !== item.reservationStatus ||
                    (drafts[item.id]?.stage ?? item.stage) !== item.stage ||
                    Boolean(drafts[item.id]?.notes)
                      ? "warning"
                      : "info"
                  }
                  title={
                    (drafts[item.id]?.reservationStatus ?? item.reservationStatus) !== item.reservationStatus ||
                    (drafts[item.id]?.stage ?? item.stage) !== item.stage ||
                    Boolean(drafts[item.id]?.notes)
                      ? "Unsaved transaction changes"
                      : "Next best action"
                  }
                  message={
                    (drafts[item.id]?.reservationStatus ?? item.reservationStatus) !== item.reservationStatus ||
                    (drafts[item.id]?.stage ?? item.stage) !== item.stage ||
                    Boolean(drafts[item.id]?.notes)
                      ? "Review the updated reservation status, stage, and note together, then save once."
                      : workflowVocabulary.transactions.nextAction({ stage, balance: item.balance })
                  }
                />
                <AdminQuickActions
                  actions={[
                    {
                      label: workflowVocabulary.transactions.quickActions.RESERVATION_FEE_PAID,
                      onClick: () =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], stage: "RESERVATION_FEE_PAID", reservationStatus: "ACTIVE" },
                        })),
                      disabled: drafts[item.id]?.stage === "RESERVATION_FEE_PAID",
                    },
                    {
                      label: workflowVocabulary.transactions.quickActions.CONTRACT_ISSUED,
                      onClick: () =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], stage: "CONTRACT_ISSUED", reservationStatus: "ACTIVE" },
                        })),
                      disabled: drafts[item.id]?.stage === "CONTRACT_ISSUED",
                    },
                    {
                      label: workflowVocabulary.transactions.quickActions.FINAL_PAYMENT_COMPLETED,
                      onClick: () =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], stage: "FINAL_PAYMENT_COMPLETED", reservationStatus: "CONVERTED" },
                        })),
                      disabled: drafts[item.id]?.stage === "FINAL_PAYMENT_COMPLETED",
                      tone: "primary",
                    },
                  ]}
                />
              </div>
              <div className="flex min-w-0 flex-col items-start justify-between gap-3 xl:items-end">
                <div className="text-eyebrow">Persisted tenant-safe actions</div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetItem(item)}
                    disabled={
                      pending === `${item.id}:reservation` ||
                      (
                        (drafts[item.id]?.reservationStatus ?? item.reservationStatus) === item.reservationStatus &&
                        (drafts[item.id]?.stage ?? item.stage) === item.stage &&
                        !drafts[item.id]?.notes
                      )
                    }
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveItem(item)}
                    disabled={
                      pending === `${item.id}:reservation` ||
                      (
                        (drafts[item.id]?.reservationStatus ?? item.reservationStatus) === item.reservationStatus &&
                        (drafts[item.id]?.stage ?? item.stage) === item.stage &&
                        !drafts[item.id]?.notes
                      )
                    }
                  >
                    {pending === `${item.id}:reservation` ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          )})
        ) : (
          <div className="px-5 py-5">
            <AdminEmptyState
              title="No active transactions yet"
              description="Transactions will appear here once buyers reserve inventory or begin payment."
            />
          </div>
        )}
      </div>
    </AdminPanel>
  );
}
