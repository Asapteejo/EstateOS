"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function QuickPaymentRequestButton({
  userId,
  transactionId,
  propertyLabel,
  outstandingBalance,
  onSent,
  readOnly = false,
  ctaHref = "/app/onboarding",
}: {
  userId: string;
  transactionId: string;
  propertyLabel: string;
  outstandingBalance: number;
  onSent?: () => void;
  readOnly?: boolean;
  ctaHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [amount, setAmount] = useState(String(outstandingBalance));
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    if (readOnly) {
      setOpen(false);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/admin/payment-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          transactionId,
          amount: Number(amount),
          currency: "NGN",
          title: "Outstanding property payment",
          purpose: `${propertyLabel} payment request`,
          collectionMethod: "HOSTED_CHECKOUT",
          channel: "EMAIL",
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          notes: notes || undefined,
        }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to send payment request.");
      }

      toast.success("Payment request sent.");
      setOpen(false);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send payment request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen((current) => !current)}>
        Send Payment Request
      </Button>
      {open ? (
        <Card className="rounded-[20px] border-sky-200 bg-sky-50 p-3 shadow-none">
          <div className="space-y-3">
            {readOnly ? (
              <div className="rounded-[16px] border border-sky-200 bg-white p-4 text-sm leading-6 text-[var(--ink-700)]">
                Payment requests are disabled in the public demo. Start your workspace to send hosted checkout links and track real collections.
              </div>
            ) : null}
            <input
              type="number"
              className="h-10 w-full rounded-2xl border border-sky-200 bg-white px-3 text-sm text-[var(--ink-900)]"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
              disabled={readOnly}
            />
            <input
              type="date"
              className="h-10 w-full rounded-2xl border border-sky-200 bg-white px-3 text-sm text-[var(--ink-900)]"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={readOnly}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm text-[var(--ink-900)] outline-none"
              placeholder="Optional note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={readOnly}
            />
            <div className="flex gap-2">
              {readOnly ? (
                <a href={ctaHref}>
                  <Button size="sm">Start your workspace</Button>
                </a>
              ) : (
                <Button size="sm" onClick={submit} disabled={pending}>
                  {pending ? "Sending..." : "Send Request"}
                </Button>
              )}
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
