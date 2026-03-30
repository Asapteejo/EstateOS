"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <Card className="p-8 text-sm leading-7 text-[var(--ink-600)]">
        No inspection bookings yet. Public and buyer-requested site visits will appear here.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking.id} className="p-6">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-[var(--ink-950)]">{booking.fullName}</h3>
                <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-medium text-[var(--ink-700)]">
                  {booking.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--ink-500)]">{booking.propertyTitle}</p>
              <div className="mt-3 text-sm text-[var(--ink-600)]">
                {booking.email}
                {booking.phone ? ` · ${booking.phone}` : ""}
              </div>
              <div className="mt-3 text-sm text-[var(--ink-700)]">
                Scheduled for {new Date(booking.scheduledFor).toLocaleString()}
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--ink-700)]">
                  <span>Status</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
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
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-[var(--ink-700)]">
                  <span>Assigned staff</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
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
                </label>
              </div>

              <label className="space-y-2 text-sm text-[var(--ink-700)]">
                <span>Scheduled for</span>
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
              </label>

              <label className="space-y-2 text-sm text-[var(--ink-700)]">
                <span>Notes</span>
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
              </label>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-[var(--ink-500)]">
                  Current owner: {booking.assignedStaffName}
                </div>
                <Button onClick={() => saveBooking(booking.id)} disabled={pendingId === booking.id}>
                  {pendingId === booking.id ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
