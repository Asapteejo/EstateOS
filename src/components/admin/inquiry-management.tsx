"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminAttentionBadge, AdminBulkActionBar, AdminEmptyState, AdminField, AdminFormSection, AdminLifecycleSteps, AdminQuickActions, AdminStateBanner } from "@/components/admin/admin-ui";
import { InquiryDraftReply } from "@/components/admin/inquiry-draft-reply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compareAttentionPriority, getAttentionTone, workflowVocabulary } from "@/modules/admin/workflow-vocabulary";
import type { InquiryManagementItem } from "@/modules/inquiries/service";

type StaffOption = {
  id: string;
  label: string;
};

const inquiryStatuses = [
  "NEW",
  "CONTACTED",
  "INSPECTION_BOOKED",
  "QUALIFIED",
  "CONVERTED",
  "CLOSED",
  "LOST",
] as const;

export function InquiryManagement({
  inquiries,
  staffOptions,
  hasAiDraft = false,
}: {
  inquiries: InquiryManagementItem[];
  staffOptions: StaffOption[];
  hasAiDraft?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [state, setState] = useState<Record<string, { status: string; assignedStaffId: string; notes: string }>>(
    Object.fromEntries(
      inquiries.map((inquiry) => [
        inquiry.id,
        {
          status: inquiry.status,
          assignedStaffId: inquiry.assignedStaffId ?? "",
          notes: inquiry.notes ?? "",
        },
      ]),
    ),
  );

  function isDirty(inquiry: InquiryManagementItem) {
    const current = state[inquiry.id];
    return (
      current.status !== inquiry.status ||
      current.assignedStaffId !== (inquiry.assignedStaffId ?? "") ||
      current.notes !== (inquiry.notes ?? "")
    );
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function applyQuickAction(inquiry: InquiryManagementItem, update: Partial<{ status: string; assignedStaffId: string; notes: string }>) {
    setState((current) => ({
      ...current,
      [inquiry.id]: {
        ...current[inquiry.id],
        ...update,
      },
    }));
  }

  async function runBulkUpdate(action: "CONTACTED" | "QUALIFIED" | "INSPECTION_BOOKED" | "assign_first_staff") {
    if (selectedIds.length === 0) {
      return;
    }

    const actionLabel = workflowVocabulary.inquiries.bulkActions[action].confirmation;

    if (!window.confirm(`Apply this update to ${selectedIds.length} selected lead${selectedIds.length === 1 ? "" : "s"}?\n\nThis will ${actionLabel}.`)) {
      return;
    }

    setBulkPending(true);
    try {
      for (const inquiry of inquiries.filter((item) => selectedIds.includes(item.id))) {
        const current = state[inquiry.id];
        const nextPayload =
          action === "assign_first_staff"
            ? {
                status: current.status,
                assignedStaffId: current.assignedStaffId || staffOptions[0]?.id || null,
                notes: current.notes || null,
              }
            : {
                status: action,
                assignedStaffId: current.assignedStaffId || null,
                notes: current.notes || null,
              };

        const response = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nextPayload),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Unable to update selected inquiries.");
        }
      }

      toast.success("Selected inquiries updated.");
      setSelectedIds([]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update selected inquiries.");
    } finally {
      setBulkPending(false);
    }
  }

  function resetInquiry(inquiry: InquiryManagementItem) {
    setState((current) => ({
      ...current,
      [inquiry.id]: {
        status: inquiry.status,
        assignedStaffId: inquiry.assignedStaffId ?? "",
        notes: inquiry.notes ?? "",
      },
    }));
  }

  function getAttentionState(inquiry: InquiryManagementItem) {
    return workflowVocabulary.inquiries.attention({
      status: state[inquiry.id]?.status ?? inquiry.status,
      createdAt: inquiry.createdAt,
      assignedStaffId: state[inquiry.id]?.assignedStaffId ?? inquiry.assignedStaffId,
    });
  }

  async function saveInquiry(inquiryId: string) {
    setPendingId(inquiryId);
    const current = state[inquiryId];
    const response = await fetch(`/api/admin/inquiries/${inquiryId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: current.status,
        assignedStaffId: current.assignedStaffId || null,
        notes: current.notes || null,
      }),
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Unable to update inquiry.");
      return;
    }

    toast.success("Inquiry updated.");
    router.refresh();
  }

  if (inquiries.length === 0) {
    return (
      <AdminEmptyState
        title="No inquiries yet"
        description="New property inquiries and contact requests will appear here once prospects start reaching out."
      />
    );
  }

  const sortedInquiries = inquiries
    .slice()
    .sort((left, right) => {
      const attentionComparison = compareAttentionPriority(
        getAttentionState(left)?.priority,
        getAttentionState(right)?.priority,
      );

      if (attentionComparison !== 0) {
        return attentionComparison;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  return (
    <div className="space-y-4">
      <AdminBulkActionBar
        selectedCount={selectedIds.length}
        description="Apply one workflow step across selected leads without opening each record individually."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => runBulkUpdate("CONTACTED")} disabled={bulkPending}>
              {workflowVocabulary.inquiries.bulkActions.CONTACTED.label}
            </Button>
            <Button size="sm" variant="outline" onClick={() => runBulkUpdate("QUALIFIED")} disabled={bulkPending}>
              {workflowVocabulary.inquiries.bulkActions.QUALIFIED.label}
            </Button>
            <Button size="sm" variant="outline" onClick={() => runBulkUpdate("INSPECTION_BOOKED")} disabled={bulkPending}>
              {workflowVocabulary.inquiries.bulkActions.INSPECTION_BOOKED.label}
            </Button>
            <Button size="sm" onClick={() => runBulkUpdate("assign_first_staff")} disabled={bulkPending || staffOptions.length === 0}>
              {workflowVocabulary.inquiries.bulkActions.assign_first_staff.label}
            </Button>
          </>
        }
      />
      {sortedInquiries.map((inquiry) => {
        const attention = getAttentionState(inquiry);
        const status = state[inquiry.id]?.status ?? inquiry.status;

        return (
        <AdminFormSection key={inquiry.id} title={inquiry.fullName} description={inquiry.propertyTitle} density="dense">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-500)]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(inquiry.id)}
                    onChange={() => toggleSelected(inquiry.id)}
                  />
                  Select
                </label>
                <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-medium text-[var(--ink-700)]">
                  {workflowVocabulary.inquiries.statusLabels[status as keyof typeof workflowVocabulary.inquiries.statusLabels] ?? status.replaceAll("_", " ")}
                </span>
                <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-500)]">
                  {inquiry.source.replaceAll("_", " ")}
                </span>
                {attention ? (
                  <AdminAttentionBadge
                    label={attention.label}
                    tone={getAttentionTone(attention.priority)}
                  />
                ) : null}
              </div>
              <p className="mt-2 text-sm text-[var(--ink-500)]">{inquiry.propertyTitle}</p>
              <div className="mt-3 text-sm text-[var(--ink-600)]">
                {inquiry.email}
                {inquiry.phone ? `  -  ${inquiry.phone}` : ""}
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-700)]">{inquiry.message}</p>
              <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Received {new Date(inquiry.createdAt).toLocaleString()}
              </div>
              <div className="mt-4">
                <AdminLifecycleSteps
                  compact
                  steps={workflowVocabulary.inquiries.steps}
                  currentIndex={workflowVocabulary.inquiries.lifecycleIndex(status)}
                />
              </div>
            </div>

            <div className="admin-surface-muted space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Status">
                  <select
                    className="admin-focus admin-interactive w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={state[inquiry.id]?.status ?? inquiry.status}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        [inquiry.id]: {
                          ...current[inquiry.id],
                          status: event.target.value,
                        },
                      }))
                    }
                  >
                    {inquiryStatuses.map((status) => (
                      <option key={status} value={status}>
                        {workflowVocabulary.inquiries.statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </AdminField>

                <AdminField label="Assigned staff">
                  <select
                    className="admin-focus admin-interactive w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={state[inquiry.id]?.assignedStaffId ?? ""}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        [inquiry.id]: {
                          ...current[inquiry.id],
                          assignedStaffId: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {staffOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </div>

              <AdminField label="Internal notes" hint="Use concise qualification or follow-up notes visible to operators only.">
                <Input
                  value={state[inquiry.id]?.notes ?? ""}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      [inquiry.id]: {
                        ...current[inquiry.id],
                        notes: event.target.value,
                      },
                    }))
                  }
                  placeholder="Context, follow-up plan, or qualification note"
                />
              </AdminField>

                <AdminStateBanner
                  tone={isDirty(inquiry) ? "warning" : "info"}
                  title={isDirty(inquiry) ? "Unsaved inquiry changes" : "Next best action"}
                  message={
                    isDirty(inquiry)
                      ? "Review owner, status, and notes together, then save once."
                      : workflowVocabulary.inquiries.nextAction(status)
                  }
                />

              <AdminQuickActions
                actions={[
                  {
                    label: workflowVocabulary.inquiries.quickActions.CONTACTED,
                    onClick: () => applyQuickAction(inquiry, { status: "CONTACTED" }),
                    disabled: state[inquiry.id]?.status === "CONTACTED",
                  },
                  {
                    label: workflowVocabulary.inquiries.quickActions.INSPECTION_BOOKED,
                    onClick: () => applyQuickAction(inquiry, { status: "INSPECTION_BOOKED" }),
                    disabled: state[inquiry.id]?.status === "INSPECTION_BOOKED",
                  },
                  {
                    label: workflowVocabulary.inquiries.quickActions.QUALIFIED,
                    onClick: () => applyQuickAction(inquiry, { status: "QUALIFIED" }),
                    disabled: state[inquiry.id]?.status === "QUALIFIED",
                    tone: "primary",
                  },
                ]}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-[var(--ink-500)]">
                  Current owner: {inquiry.assignedStaffName}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => resetInquiry(inquiry)} disabled={!isDirty(inquiry) || pendingId === inquiry.id}>
                    Reset
                  </Button>
                  <Button onClick={() => saveInquiry(inquiry.id)} disabled={pendingId === inquiry.id || !isDirty(inquiry)}>
                    {pendingId === inquiry.id ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>

              {hasAiDraft && (
                <div className="border-t border-[var(--line)] pt-4">
                  <InquiryDraftReply
                    inquiryId={inquiry.id}
                    recipientEmail={inquiry.email}
                    recipientName={inquiry.fullName}
                  />
                </div>
              )}
            </div>
          </div>
        </AdminFormSection>
      )})}
    </div>
  );
}
