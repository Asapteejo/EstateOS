"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type TransactionItem = {
  id: string;
  reservationId: string;
  reference: string;
  reservationStatus: string;
  property: string;
  buyer: string;
  stage: string;
  balance: number;
};

const transactionStages = [
  "INQUIRY_RECEIVED",
  "KYC_SUBMITTED",
  "RESERVATION_FEE_PAID",
  "CONTRACT_ISSUED",
  "ALLOCATION_IN_PROGRESS",
  "LEGAL_VERIFICATION",
  "FINAL_PAYMENT_COMPLETED",
  "HANDOVER_COMPLETED",
];

const reservationStatuses = ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "CONVERTED"];

export function TransactionManagement({ items }: { items: TransactionItem[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  async function updateReservation(item: TransactionItem, status: string) {
    setPending(`${item.id}:reservation`);
    const response = await fetch(`/api/admin/reservations/${item.reservationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        notes: notes[item.id] || undefined,
      }),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update reservation.");
      return;
    }

    toast.success("Reservation updated.");
    router.refresh();
  }

  async function updateTransaction(item: TransactionItem, stage: string) {
    setPending(`${item.id}:transaction`);
    const response = await fetch(`/api/admin/transactions/${item.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage,
        notes: notes[item.id] || undefined,
      }),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update transaction.");
      return;
    }

    toast.success("Transaction stage updated.");
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--line)] px-6 py-4">
        <h3 className="text-lg font-semibold text-[var(--ink-950)]">Live transaction operations</h3>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-4 px-6 py-5 xl:grid-cols-[1fr_1fr_1.2fr_auto]">
              <div>
                <div className="font-semibold text-[var(--ink-950)]">{item.reference}</div>
                <div className="mt-1 text-sm text-[var(--ink-500)]">{item.property} • {item.buyer}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{item.reservationStatus.toLowerCase()}</Badge>
                  <Badge>{item.stage.toLowerCase().replaceAll("_", " ")}</Badge>
                </div>
              </div>
              <div className="space-y-3 text-sm text-[var(--ink-700)]">
                <div>Outstanding: {formatCurrency(item.balance)}</div>
                <select
                  className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                  defaultValue={item.reservationStatus}
                  onChange={(event) => updateReservation(item, event.target.value)}
                  disabled={!item.reservationId || pending === `${item.id}:reservation`}
                >
                  {reservationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <select
                  className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                  defaultValue={item.stage}
                  onChange={(event) => updateTransaction(item, event.target.value)}
                  disabled={pending === `${item.id}:transaction`}
                >
                  {transactionStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <Textarea
                  placeholder="Operator note"
                  value={notes[item.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  className="min-h-24"
                />
              </div>
              <div className="flex items-center justify-end text-sm text-[var(--ink-500)]">
                Persisted tenant-safe actions
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-10 text-center text-sm text-[var(--ink-500)]">
            No active transactions yet.
          </div>
        )}
      </div>
    </Card>
  );
}
