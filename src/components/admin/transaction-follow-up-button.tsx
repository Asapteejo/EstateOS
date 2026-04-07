"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function TransactionFollowUpButton({
  transactionId,
  onUpdated,
}: {
  transactionId: string;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [followUpStatus, setFollowUpStatus] = useState("CONTACTED");
  const [followUpNote, setFollowUpNote] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  async function submit() {
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
        <Card className="rounded-[20px] border-rose-200 bg-rose-50 p-3 shadow-none">
          <div className="space-y-3">
            <select
              className="h-10 w-full rounded-2xl border border-rose-200 bg-white px-3 text-sm text-[var(--ink-900)]"
              value={followUpStatus}
              onChange={(event) => setFollowUpStatus(event.target.value)}
            >
              <option value="CONTACTED">Contacted</option>
              <option value="PROMISED_TO_PAY">Promised to pay</option>
              <option value="NOT_REACHABLE">Not reachable</option>
              <option value="CLOSED">Resolved</option>
            </select>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm text-[var(--ink-900)] outline-none"
              placeholder="Add a short collections note"
              value={followUpNote}
              onChange={(event) => setFollowUpNote(event.target.value)}
            />
            <input
              type="date"
              className="h-10 w-full rounded-2xl border border-rose-200 bg-white px-3 text-sm text-[var(--ink-900)]"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
