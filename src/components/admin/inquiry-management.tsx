"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
}: {
  inquiries: InquiryManagementItem[];
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
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
      <Card className="p-8 text-sm leading-7 text-[var(--ink-600)]">
        No inquiries yet. New property inquiries and contact requests will appear here.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {inquiries.map((inquiry) => (
        <Card key={inquiry.id} className="p-6">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-[var(--ink-950)]">{inquiry.fullName}</h3>
                <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-medium text-[var(--ink-700)]">
                  {inquiry.status.replaceAll("_", " ")}
                </span>
                <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-500)]">
                  {inquiry.source.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--ink-500)]">{inquiry.propertyTitle}</p>
              <div className="mt-3 text-sm text-[var(--ink-600)]">
                {inquiry.email}
                {inquiry.phone ? ` · ${inquiry.phone}` : ""}
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-700)]">{inquiry.message}</p>
              <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Received {new Date(inquiry.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--ink-700)]">
                  <span>Status</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
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
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-[var(--ink-700)]">
                  <span>Assigned staff</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
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
                </label>
              </div>

              <label className="space-y-2 text-sm text-[var(--ink-700)]">
                <span>Internal notes</span>
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
              </label>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-[var(--ink-500)]">
                  Current owner: {inquiry.assignedStaffName}
                </div>
                <Button onClick={() => saveInquiry(inquiry.id)} disabled={pendingId === inquiry.id}>
                  {pendingId === inquiry.id ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
