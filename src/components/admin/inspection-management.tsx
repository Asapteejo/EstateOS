"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminAttentionBadge, AdminBulkActionBar, AdminEmptyState, AdminField, AdminFormSection, AdminLifecycleSteps, AdminQuickActions, AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compareAttentionPriority, getAttentionTone, workflowVocabulary } from "@/modules/admin/workflow-vocabulary";
import type { InspectionManagementItem } from "@/modules/inspections/service";

type StaffOption = {
  id: string;
  label: string;
};

const inspectionStatuses = [
  "REQUESTED",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export function InspectionManagement({
  bookings,
  staffOptions,
}: {
  bookings: InspectionManagementItem[];
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [state, setState] = useState<
    Record<string, { status: string; assignedStaffId: string; notes: string; scheduledFor: string }>
  >(
    Object.fromEntries(
      bookings.map((booking) => [
        booking.id,
        {
          status: booking.status,
          assignedStaffId: booking.assignedStaffId ?? "",
          notes: booking.notes ?? "",
          scheduledFor: booking.scheduledFor.slice(0, 16),
        },
      ]),
    ),
  );

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function applyQuickAction(
    booking: InspectionManagementItem,
    update: Partial<{ status: string; assignedStaffId: string; notes: string; scheduledFor: string }>,
  ) {
    setState((current) => ({
      ...current,
      [booking.id]: {
        ...current[booking.id],
        ...update,
      },
    }));
  }

  async function runBulkUpdate(action: "CONFIRMED" | "COMPLETED" | "assign_first_staff") {
    if (selectedIds.length === 0) {
      return;
    }

    const actionLabel = workflowVocabulary.inspections.bulkActions[action].confirmation;

    if (!window.confirm(`Apply this update to ${selectedIds.length} selected visit${selectedIds.length === 1 ? "" : "s"}?\n\nThis will ${actionLabel}.`)) {
      return;
    }

    setBulkPending(true);
    try {
      for (const booking of bookings.filter((item) => selectedIds.includes(item.id))) {
        const current = state[booking.id];
        const nextPayload =
          action === "assign_first_staff"
            ? {
                status: current.status,
                assignedStaffId: current.assignedStaffId || staffOptions[0]?.id || null,
                notes: current.notes || null,
                scheduledFor: new Date(current.scheduledFor).toISOString(),
              }
            : {
                status: action,
                assignedStaffId: current.assignedStaffId || null,
                notes: current.notes || null,
                scheduledFor: new Date(current.scheduledFor).toISOString(),
              };

        const response = await fetch(`/api/admin/inspections/${booking.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nextPayload),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Unable to update selected inspections.");
        }
      }

      toast.success("Selected inspections updated.");
      setSelectedIds([]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update selected inspections.");
    } finally {
      setBulkPending(false);
    }
  }

  function isDirty(booking: InspectionManagementItem) {
    const current = state[booking.id];
    return (
      current.status !== booking.status ||
      current.assignedStaffId !== (booking.assignedStaffId ?? "") ||
      current.notes !== (booking.notes ?? "") ||
      current.scheduledFor !== booking.scheduledFor.slice(0, 16)
    );
  }

  function resetBooking(booking: InspectionManagementItem) {
    setState((current) => ({
      ...current,
      [booking.id]: {
        status: booking.status,
        assignedStaffId: booking.assignedStaffId ?? "",
        notes: booking.notes ?? "",
        scheduledFor: booking.scheduledFor.slice(0, 16),
      },
    }));
  }

  function getAttentionState(booking: InspectionManagementItem) {
    return workflowVocabulary.inspections.attention({
      status: state[booking.id]?.status ?? booking.status,
      scheduledFor: state[booking.id]?.scheduledFor ?? booking.scheduledFor,
    });
  }

  async function saveBooking(bookingId: string) {
    setPendingId(bookingId);
    const current = state[bookingId];

    const response = await fetch(`/api/admin/inspections/${bookingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: current.status,
        assignedStaffId: current.assignedStaffId || null,
        notes: current.notes || null,
        scheduledFor: new Date(current.scheduledFor).toISOString(),
      }),
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Unable to update inspection booking.");
      return;
    }

    toast.success("Inspection booking updated.");
    router.refresh();
  }

  if (bookings.length === 0) {
    return (
      <AdminEmptyState
        title="No inspection bookings yet"
        description="Public and buyer-requested site visits will appear here once bookings begin to flow into the tenant workspace."
      />
    );
  }

  const sortedBookings = bookings
    .slice()
    .sort((left, right) => {
      const attentionComparison = compareAttentionPriority(
        getAttentionState(left)?.priority,
        getAttentionState(right)?.priority,
      );

      if (attentionComparison !== 0) {
        return attentionComparison;
      }

      return new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime();
    });

  return (
    <div className="space-y-4">
      <AdminBulkActionBar
        selectedCount={selectedIds.length}
        description="Apply the same field-visit action across selected bookings when the team is moving in a batch."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => runBulkUpdate("CONFIRMED")} disabled={bulkPending}>
              {workflowVocabulary.inspections.bulkActions.CONFIRMED.label}
            </Button>
            <Button size="sm" variant="outline" onClick={() => runBulkUpdate("COMPLETED")} disabled={bulkPending}>
              {workflowVocabulary.inspections.bulkActions.COMPLETED.label}
            </Button>
            <Button size="sm" onClick={() => runBulkUpdate("assign_first_staff")} disabled={bulkPending || staffOptions.length === 0}>
              {workflowVocabulary.inspections.bulkActions.assign_first_staff.label}
            </Button>
          </>
        }
      />
      {sortedBookings.map((booking) => {
        const attention = getAttentionState(booking);
        const status = state[booking.id]?.status ?? booking.status;

        return (
        <AdminFormSection key={booking.id} title={booking.fullName} description={booking.propertyTitle} density="dense">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-500)]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(booking.id)}
                    onChange={() => toggleSelected(booking.id)}
                  />
                  Select
                </label>
                <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-medium text-[var(--ink-700)]">
                  {workflowVocabulary.inspections.statusLabels[status as keyof typeof workflowVocabulary.inspections.statusLabels] ?? status.replaceAll("_", " ")}
                </span>
                {attention ? (
                  <AdminAttentionBadge
                    label={attention.label}
                    tone={getAttentionTone(attention.priority)}
                  />
                ) : null}
              </div>
              <p className="mt-2 text-sm text-[var(--ink-500)]">{booking.propertyTitle}</p>
              <div className="mt-3 text-sm text-[var(--ink-600)]">
                {booking.email}
                {booking.phone ? `  -  ${booking.phone}` : ""}
              </div>
              <div className="mt-3 text-sm text-[var(--ink-700)]">
                Scheduled for {new Date(booking.scheduledFor).toLocaleString()}
              </div>
              <div className="mt-4">
                <AdminLifecycleSteps
                  compact
                  steps={workflowVocabulary.inspections.steps}
                  currentIndex={workflowVocabulary.inspections.lifecycleIndex(status)}
                />
              </div>
            </div>

            <div className="admin-surface-muted space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Status">
                  <select
                    className="admin-focus admin-interactive w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={state[booking.id]?.status ?? booking.status}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        [booking.id]: {
                          ...current[booking.id],
                          status: event.target.value,
                        },
                      }))
                    }
                  >
                    {inspectionStatuses.map((status) => (
                      <option key={status} value={status}>
                        {workflowVocabulary.inspections.statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </AdminField>

                <AdminField label="Assigned staff">
                  <select
                    className="admin-focus admin-interactive w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={state[booking.id]?.assignedStaffId ?? ""}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        [booking.id]: {
                          ...current[booking.id],
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

              <AdminField label="Scheduled for">
                <Input
                  type="datetime-local"
                  value={state[booking.id]?.scheduledFor ?? ""}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      [booking.id]: {
                        ...current[booking.id],
                        scheduledFor: event.target.value,
                      },
                    }))
                  }
                />
              </AdminField>

              <AdminField label="Notes" hint="Capture confirmation details, arrival notes, or reschedule reasons for operators.">
                <Input
                  value={state[booking.id]?.notes ?? ""}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      [booking.id]: {
                        ...current[booking.id],
                        notes: event.target.value,
                      },
                    }))
                  }
                  placeholder="Confirmation details, arrival notes, or reschedule reason"
                />
              </AdminField>

                <AdminStateBanner
                  tone={isDirty(booking) ? "warning" : "info"}
                  title={isDirty(booking) ? "Unsaved inspection changes" : "Next best action"}
                  message={
                    isDirty(booking)
                      ? "Review the assigned owner, visit slot, and note together, then save once."
                      : workflowVocabulary.inspections.nextAction(status)
                  }
                />

              <AdminQuickActions
                actions={[
                  {
                    label: workflowVocabulary.inspections.quickActions.CONFIRMED,
                    onClick: () => applyQuickAction(booking, { status: "CONFIRMED" }),
                    disabled: state[booking.id]?.status === "CONFIRMED",
                  },
                  {
                    label: workflowVocabulary.inspections.quickActions.COMPLETED,
                    onClick: () => applyQuickAction(booking, { status: "COMPLETED" }),
                    disabled: state[booking.id]?.status === "COMPLETED",
                    tone: "primary",
                  },
                  {
                    label: workflowVocabulary.inspections.quickActions.RESCHEDULED,
                    onClick: () => applyQuickAction(booking, { status: "RESCHEDULED" }),
                    disabled: state[booking.id]?.status === "RESCHEDULED",
                  },
                ]}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-[var(--ink-500)]">
                  Current owner: {booking.assignedStaffName}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => resetBooking(booking)} disabled={!isDirty(booking) || pendingId === booking.id}>
                    Reset
                  </Button>
                  <Button onClick={() => saveBooking(booking.id)} disabled={pendingId === booking.id || !isDirty(booking)}>
                    {pendingId === booking.id ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </AdminFormSection>
      )})}
    </div>
  );
}
