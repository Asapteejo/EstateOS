"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function CompanyLifecycleControls({
  companyId,
  companyName,
  status,
}: {
  companyId: string;
  companyName: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const nextStatus = status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

  async function submit() {
    const response = await fetch(`/api/superadmin/companies/${companyId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: nextStatus,
        reason: reason.trim() || null,
      }),
    });

    if (!response.ok) {
      return;
    }

    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Button variant={status === "SUSPENDED" ? "default" : "outline"} onClick={() => setOpen(true)}>
        {status === "SUSPENDED" ? "Reactivate company" : "Suspend company"}
      </Button>
      {open ? (
        <div className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
          <div className="text-sm font-semibold text-[var(--ink-950)]">
            {nextStatus === "SUSPENDED" ? `Suspend ${companyName}?` : `Reactivate ${companyName}?`}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
            {nextStatus === "SUSPENDED"
              ? "This blocks admin access, portal access, and authenticated payment actions for the company."
              : "This restores the company workspace and re-enables admin and buyer flows."}
          </p>
          <label className="mt-4 block text-sm text-[var(--ink-600)]">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 min-h-[96px] w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-500)]"
              placeholder={
                nextStatus === "SUSPENDED"
                  ? "Optional internal reason for the suspension"
                  : "Optional note for why the company is being restored"
              }
            />
          </label>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                startTransition(() => {
                  void submit();
                })
              }
              disabled={isPending}
            >
              {isPending ? "Saving..." : nextStatus === "SUSPENDED" ? "Confirm suspension" : "Confirm reactivation"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
