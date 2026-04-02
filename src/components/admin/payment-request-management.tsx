"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ClientOption = {
  id: string;
  label: string;
  transactionId: string | null;
  reservationId: string | null;
  outstandingBalance: string;
};

type PaymentRequestRow = {
  id: string;
  title: string;
  purpose: string;
  amount: string;
  status: string;
  collectionMethod: string;
  dueAt: string | null;
  buyer: string;
  reference: string | null;
  transferSummary: string | null;
  checkoutUrl: string | null;
};

export function PaymentRequestManagement({
  clients,
  requests,
}: {
  clients: ClientOption[];
  requests: PaymentRequestRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? "");
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const [form, setForm] = useState({
    title: "Outstanding property payment",
    purpose: "Property payment request",
    amount: "",
    collectionMethod: "HOSTED_CHECKOUT",
    channel: "EMAIL",
    dueAt: "",
    notes: "",
  });

  async function submit() {
    if (!selectedClient) {
      toast.error("Select a client with an active reservation or transaction.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/admin/payment-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: selectedClient.id,
        transactionId: selectedClient.transactionId,
        reservationId: selectedClient.reservationId,
        currency: "NGN",
        amount: Number(form.amount),
        title: form.title,
        purpose: form.purpose,
        collectionMethod: form.collectionMethod,
        channel: form.channel,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        notes: form.notes,
      }),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to create payment request.");
      return;
    }

    toast.success("Payment request created.");
    setForm((current) => ({ ...current, amount: "", notes: "" }));
    router.refresh();
  }

  async function updateStatus(id: string, status: "CANCELLED" | "EXPIRED") {
    const response = await fetch(`/api/admin/payment-requests/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update payment request.");
      return;
    }

    toast.success(`Payment request ${status.toLowerCase()}.`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <h3 className="text-xl font-semibold text-[var(--ink-950)]">Create payment request</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
          Create a clear payment request for a buyer. Paystack hosted checkout is global-ready; temporary transfer account requests are Nigeria/Paystack-specific and only populate bank details when the provider returns them.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Client / active deal">
            <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
            {selectedClient ? <p className="mt-2 text-xs text-[var(--ink-500)]">Outstanding balance: {selectedClient.outstandingBalance}</p> : null}
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Request title">
              <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </Field>
            <Field label="Amount">
              <input type="number" className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </Field>
          </div>

          <Field label="Purpose">
            <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Collection method">
              <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={form.collectionMethod} onChange={(event) => setForm((current) => ({ ...current, collectionMethod: event.target.value }))}>
                <option value="HOSTED_CHECKOUT">Hosted checkout</option>
                <option value="BANK_TRANSFER_TEMP_ACCOUNT">Paystack temporary transfer account</option>
                <option value="CARD_LINK">Card link</option>
                <option value="MANUAL_BANK_TRANSFER_REFERENCE">Manual bank transfer reference</option>
              </select>
            </Field>
            <Field label="Delivery channel">
              <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}>
                <option value="EMAIL">Email</option>
                <option value="IN_APP">In-app</option>
                <option value="SHARE_LINK">Share link</option>
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </Field>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={pending || !selectedClient}>
              {pending ? "Creating..." : "Create payment request"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <h3 className="text-xl font-semibold text-[var(--ink-950)]">Recent payment requests</h3>
        <div className="mt-5 space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-2xl bg-[var(--sand-100)] p-4 text-sm text-[var(--ink-700)]">
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-[var(--ink-950)]">{request.title}</div>
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{request.status}</div>
              </div>
              <div className="mt-2 text-[var(--ink-600)]">{request.buyer}</div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs uppercase tracking-[0.14em] text-[var(--ink-500)]">
                <span>{request.amount}</span>
                <span>{request.collectionMethod}</span>
                {request.dueAt ? <span>Due {request.dueAt}</span> : null}
              </div>
              {request.transferSummary ? <p className="mt-3 text-sm text-[var(--ink-700)]">{request.transferSummary}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3">
                {request.checkoutUrl ? (
                  <a href={request.checkoutUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">Open payment link</Button>
                  </a>
                ) : null}
                {request.checkoutUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(request.checkoutUrl ?? "");
                      toast.success("Payment link copied.");
                    }}
                  >
                    Copy link
                  </Button>
                ) : null}
                {request.status === "SENT" || request.status === "AWAITING_PAYMENT" ? (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(request.id, "CANCELLED")}>
                    Cancel
                  </Button>
                ) : null}
                {request.reference ? <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs text-[var(--ink-500)]">{request.reference}</span> : null}
              </div>
            </div>
          ))}
          {requests.length === 0 ? <p className="text-sm text-[var(--ink-500)]">No payment requests yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--ink-700)]">{label}</span>
      {children}
    </label>
  );
}
