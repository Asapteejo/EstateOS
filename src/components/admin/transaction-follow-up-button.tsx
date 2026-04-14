"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AdminModalFrame, AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function TransactionFollowUpButton({
  transactionId,
  onUpdated,
  readOnly = false,
  ctaHref = "/app/onboarding",
}: {
  transactionId: string;
  onUpdated?: () => void;
  readOnly?: boolean;
  ctaHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [followUpStatus, setFollowUpStatus] = useState("CONTACTED");
  const [followUpNote, setFollowUpNote] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  async function submit() {
    if (readOnly) {
      setOpen(false);
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/admin/transactions/${transactionId}/follow-up`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followUpStatus,
          followUpNote,
          nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : undefined,
        }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to update follow-up.");
      }

      toast.success("Collections follow-up updated.");
      setOpen(false);
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update follow-up.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        className="w-full bg-rose-600 hover:bg-rose-700"
        onClick={() => setOpen((current) => !current)}
      >
        Follow Up Now
      </Button>
      {open ? (
        <AdminModalFrame
          title="Collections follow-up"
          description="Log the latest collections outcome and set the next follow-up date in one step."
          footer={
            <div className="flex gap-2">
              {readOnly ? (
                <a href={ctaHref}>
                  <Button size="sm">Start your workspace</Button>
                </a>
              ) : (
                <Button size="sm" onClick={submit} disabled={pending}>
                  {pending ? "Saving..." : "Save"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {readOnly ? (
              <AdminStateBanner
                tone="warning"
                title="Collections actions are read-only in the demo"
                message="Start your workspace to log real follow-up outcomes and track overdue money."
              />
            ) : (
              <AdminStateBanner
                tone="info"
                title="Next best action"
                message="Use this when money is still outstanding or a promised payment date needs operator follow-up."
              />
            )}
            <select
              className="h-10 w-full rounded-[var(--radius-md)] border border-[color:var(--danger-200)] bg-white px-3 text-sm text-[var(--ink-900)]"
              value={followUpStatus}
              onChange={(event) => setFollowUpStatus(event.target.value)}
              disabled={readOnly}
            >
              <option value="CONTACTED">Contacted</option>
              <option value="PROMISED_TO_PAY">Promised to pay</option>
              <option value="NOT_REACHABLE">Not reachable</option>
              <option value="CLOSED">Resolved</option>
            </select>
            <Textarea
              className="min-h-24 border-[color:var(--danger-200)]"
              placeholder="Add a short collections note"
              value={followUpNote}
              onChange={(event) => setFollowUpNote(event.target.value)}
              disabled={readOnly}
            />
            <input
              type="date"
              className="h-10 w-full rounded-[var(--radius-md)] border border-[color:var(--danger-200)] bg-white px-3 text-sm text-[var(--ink-900)]"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
              disabled={readOnly}
            />
          </div>
        </AdminModalFrame>
      ) : null}
    </div>
  );
}
