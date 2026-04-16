"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AdminModalFrame, AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function QuickPaymentRequestButton({
  userId,
  transactionId,
  propertyLabel,
  outstandingBalance,
  onSent,
  readOnly = false,
  ctaHref = "/app/onboarding",
  hasPaymentAccount = true,
}: {
  userId: string;
  transactionId: string;
  propertyLabel: string;
  outstandingBalance: number;
  onSent?: () => void;
  readOnly?: boolean;
  ctaHref?: string;
  hasPaymentAccount?: boolean;
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
        <AdminModalFrame
          title="Quick payment request"
          description="Send a hosted checkout request directly from the transaction context."
          footer={
            <div className="flex gap-2">
              {readOnly ? (
                <a href={ctaHref}>
                  <Button size="sm">Start your workspace</Button>
                </a>
              ) : (
                <Button size="sm" onClick={submit} disabled={pending || Number(amount) <= 0}>
                  {pending ? "Sending..." : "Send request"}
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
                title="Payment requests are disabled in the public demo"
                message="Start your workspace to send hosted checkout links and track real collections."
              />
            ) : !hasPaymentAccount ? (
              <AdminStateBanner
                tone="warning"
                title="Payment account not connected"
                message={
                  <>
                    Set up your Paystack subaccount in{" "}
                    <a href="/admin/settings" className="font-semibold underline underline-offset-2">
                      Settings
                    </a>{" "}
                    before sending payment requests so buyers can complete checkout.
                  </>
                }
              />
            ) : (
              <AdminStateBanner
                tone="info"
                title="Primary next step"
                message="Use the current outstanding balance unless you are intentionally collecting a partial amount."
              />
            )}
            <Input
              type="number"
              className="border-sky-200"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
              disabled={readOnly}
            />
            <Input
              type="date"
              className="border-sky-200"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={readOnly}
            />
            <Textarea
              className="min-h-24 border-sky-200"
              placeholder="Optional note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={readOnly}
            />
          </div>
        </AdminModalFrame>
      ) : null}
    </div>
  );
}
