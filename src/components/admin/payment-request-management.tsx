"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminAttentionBadge, AdminEmptyState, AdminField, AdminFormSection, AdminPanel, AdminQuickActions, AdminStateBanner, AdminToolbar } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

function getRequestAttentionState(request: PaymentRequestRow): { label: string; tone: "warning" | "danger" | "info" | "success" } | null {
  if (!request.dueAt) {
    return request.status === "PAID" ? { label: "Paid", tone: "success" } : null;
  }

  const dueAt = new Date(request.dueAt).getTime();
  const hoursUntilDue = (dueAt - Date.now()) / (1000 * 60 * 60);

  if ((request.status === "SENT" || request.status === "AWAITING_PAYMENT") && hoursUntilDue < 0) {
    return { label: "Overdue", tone: "danger" };
  }
  if ((request.status === "SENT" || request.status === "AWAITING_PAYMENT") && hoursUntilDue <= 24) {
    return { label: "Due today", tone: "warning" };
  }
  if (request.status === "PAID") {
    return { label: "Paid", tone: "success" };
  }

  return null;
}

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

  function handleClientChange(value: string) {
    const nextClient = clients.find((client) => client.id === value) ?? null;
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 7);

    setSelectedClientId(value);
    setForm((current) => ({
      ...current,
      title: nextClient ? `Outstanding payment - ${nextClient.label}` : "Outstanding property payment",
      dueAt: current.dueAt || nextDueDate.toISOString().slice(0, 10),
    }));
  }

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
    if (status === "CANCELLED" && !window.confirm("Cancel this payment request? Buyers will no longer be able to act on it.")) {
      return;
    }

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
      <AdminFormSection title="Create payment request" description="Create a clear buyer request with a hosted checkout, transfer reference, or shareable link.">
        <AdminToolbar className="border-dashed bg-[var(--sand-50)]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
              Primary operator task
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
              Select the active deal, confirm the amount, then send a buyer-ready request in one pass.
            </p>
          </div>
        </AdminToolbar>

        <AdminStateBanner
          tone="info"
          title="Provider behavior varies by collection method"
          message="Hosted checkout is global-ready. Temporary transfer account requests are Paystack-specific and only show bank details when the provider returns them."
        />

        <div className="space-y-4">
          <AdminField label="Client / active deal" hint={selectedClient ? `Outstanding balance: ${selectedClient.outstandingBalance}` : undefined}>
            <select className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm" value={selectedClientId} onChange={(event) => handleClientChange(event.target.value)}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
          </AdminField>

          <div className="grid gap-4 md:grid-cols-2">
            <AdminField label="Request title">
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </AdminField>
            <AdminField label="Amount" hint="Use the current outstanding balance unless you are deliberately collecting a partial amount.">
              <Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </AdminField>
          </div>

          <AdminField label="Purpose">
            <Input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} />
          </AdminField>

          <div className="grid gap-4 md:grid-cols-3">
            <AdminField label="Collection method">
              <select className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm" value={form.collectionMethod} onChange={(event) => setForm((current) => ({ ...current, collectionMethod: event.target.value }))}>
                <option value="HOSTED_CHECKOUT">Hosted checkout</option>
                <option value="BANK_TRANSFER_TEMP_ACCOUNT">Paystack temporary transfer account</option>
                <option value="CARD_LINK">Card link</option>
                <option value="MANUAL_BANK_TRANSFER_REFERENCE">Manual bank transfer reference</option>
              </select>
            </AdminField>
            <AdminField label="Delivery channel">
              <select className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm" value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}>
                <option value="EMAIL">Email</option>
                <option value="IN_APP">In-app</option>
                <option value="SHARE_LINK">Share link</option>
              </select>
            </AdminField>
            <AdminField label="Due date">
              <Input type="date" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
            </AdminField>
          </div>

          <AdminField label="Notes">
            <Textarea className="min-h-24" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </AdminField>

          <AdminQuickActions
            title="Smart defaults"
            actions={[
              {
                label: "Due in 3 days",
                onClick: () => {
                  const date = new Date();
                  date.setDate(date.getDate() + 3);
                  setForm((current) => ({ ...current, dueAt: date.toISOString().slice(0, 10) }));
                },
              },
              {
                label: "Due in 7 days",
                onClick: () => {
                  const date = new Date();
                  date.setDate(date.getDate() + 7);
                  setForm((current) => ({ ...current, dueAt: date.toISOString().slice(0, 10) }));
                },
              },
              {
                label: "Clear note",
                onClick: () => setForm((current) => ({ ...current, notes: "" })),
                disabled: !form.notes,
              },
            ]}
          />

          <div className="flex justify-end">
            <Button onClick={submit} disabled={pending || !selectedClient || Number(form.amount) <= 0}>
              {pending ? "Creating..." : "Create payment request"}
            </Button>
          </div>
        </div>
      </AdminFormSection>

      <AdminPanel title="Recent payment requests" description="Track newly created requests, copied links, and requests still awaiting payment.">
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="admin-surface-muted px-4 py-4 text-sm text-[var(--ink-700)]">
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-[var(--ink-950)]">{request.title}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{request.status}</div>
                  {getRequestAttentionState(request) ? (
                    <AdminAttentionBadge
                      label={getRequestAttentionState(request)?.label ?? ""}
                      tone={getRequestAttentionState(request)?.tone ?? "info"}
                    />
                  ) : null}
                </div>
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
                {request.reference ? <span className="admin-chip bg-white">{request.reference}</span> : null}
              </div>
            </div>
          ))}
          {requests.length === 0 ? (
            <AdminEmptyState
              title="No payment requests yet"
              description="Create the first request to start collecting reservation or outstanding balance payments from buyers."
            />
          ) : null}
        </div>
      </AdminPanel>
    </div>
  );
}
