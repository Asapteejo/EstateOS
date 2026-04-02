"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdminClientProfile } from "@/modules/clients/queries";

export function ClientActivityView({ client }: { client: AdminClientProfile }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { assignedStaffId: string; followUpStatus: string; followUpNote: string }>>(
    Object.fromEntries(
      client.wishlistItems.map((item) => [
        item.id,
        {
          assignedStaffId: item.assignedStaffId ?? "",
          followUpStatus: item.followUpStatus,
          followUpNote: item.followUpNote ?? "",
        },
      ]),
    ),
  );

  async function saveWishlistFollowUp(wishlistId: string) {
    setPendingId(wishlistId);
    const response = await fetch(`/api/admin/wishlists/${wishlistId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(drafts[wishlistId]),
    });
    setPendingId(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update follow-up.");
      return;
    }

    toast.success("Follow-up updated.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Wishlist items", String(client.summary.wishlistCount)],
          ["Reservations", String(client.summary.reservationCount)],
          ["Payments", String(client.summary.paymentCount)],
          ["Outstanding", client.summary.outstandingBalance],
          ["Latest activity", client.summary.latestActivity],
        ].map(([label, value]) => (
          <Card key={label} className="rounded-[28px] border-[var(--line)] bg-white p-5">
            <div className="text-sm text-[var(--ink-500)]">{label}</div>
            <div className="mt-3 text-xl font-semibold text-[var(--ink-950)]">{value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
        <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
          <h2 className="text-xl font-semibold text-[var(--ink-950)]">Client profile</h2>
          <div className="mt-5 space-y-4 text-sm text-[var(--ink-600)]">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">Client</div>
              <div className="mt-1 text-lg font-semibold text-[var(--ink-950)]">{client.name}</div>
            </div>
            <div>{client.email}</div>
            {client.phone ? <div>{client.phone}</div> : null}
            <div>KYC: <strong>{client.kycStatus}</strong></div>
            <div>Assigned marketer: <strong>{client.assignedMarketer ?? "Unassigned"}</strong></div>
            <div>Location: <strong>{[client.city, client.state].filter(Boolean).join(", ") || "Not completed"}</strong></div>
            <div>Occupation: <strong>{client.occupation ?? "Not completed"}</strong></div>
          </div>
        </Card>

        <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
          <h2 className="text-xl font-semibold text-[var(--ink-950)]">Recent client activity</h2>
          <div className="mt-5 space-y-4">
            {client.timeline.map((event) => (
              <div key={`${event.title}-${event.time}`} className="rounded-3xl bg-[var(--sand-100)] p-4">
                <div className="text-sm font-semibold text-[var(--ink-950)]">{event.title}</div>
                <div className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{event.detail}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{event.time}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <h2 className="text-xl font-semibold text-[var(--ink-950)]">Wishlist intent and follow-up</h2>
        <div className="mt-5 space-y-4">
          {client.wishlistItems.map((item) => (
            <div key={item.id} className="rounded-[28px] border border-[var(--line)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-[var(--ink-950)]">{item.propertyTitle}</div>
                  <div className="mt-1 text-sm text-[var(--ink-500)]">
                    Saved {item.savedAt} · {item.timeLabel}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{item.status}</Badge>
                  <Badge>{item.followUpStatus}</Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <select
                  className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                  value={drafts[item.id]?.assignedStaffId ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: {
                        ...current[item.id],
                        assignedStaffId: event.target.value,
                      },
                    }))
                  }
                >
                  <option value="">No follow-up owner</option>
                  {client.followUpStaffOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                  value={drafts[item.id]?.followUpStatus ?? "NONE"}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: {
                        ...current[item.id],
                        followUpStatus: event.target.value,
                      },
                    }))
                  }
                >
                  <option value="NONE">None</option>
                  <option value="PENDING_CALL">Pending call</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="FOLLOW_UP_SCHEDULED">Follow-up scheduled</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <div className="flex gap-2">
                  {item.whatsappHref ? (
                    <a href={item.whatsappHref} target="_blank" rel="noreferrer">
                      <Button variant="outline">WhatsApp</Button>
                    </a>
                  ) : null}
                  <Button onClick={() => saveWishlistFollowUp(item.id)} disabled={pendingId === item.id}>
                    {pendingId === item.id ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              <textarea
                className="mt-4 min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--ink-700)]"
                placeholder="Follow-up note"
                value={drafts[item.id]?.followUpNote ?? ""}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [item.id]: {
                      ...current[item.id],
                      followUpNote: event.target.value,
                    },
                  }))
                }
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/properties/${item.propertySlug}`}>
                  <Button variant="ghost">Open property</Button>
                </Link>
                {item.assignedStaffName ? (
                  <div className="text-sm text-[var(--ink-500)]">Owner: {item.assignedStaffName}</div>
                ) : null}
              </div>
            </div>
          ))}
          {client.wishlistItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-500)]">
              No wishlist activity yet for this client.
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SimpleListCard
          title="Inquiries"
          empty="No inquiries yet."
          rows={client.inquiries.map((item) => ({
            title: item.propertyTitle,
            subtitle: `${item.status} · ${item.assignedStaffName}`,
            meta: item.createdAt,
          }))}
        />
        <SimpleListCard
          title="Inspections"
          empty="No inspections yet."
          rows={client.inspections.map((item) => ({
            title: item.propertyTitle,
            subtitle: `${item.status} · ${item.assignedStaffName}`,
            meta: item.scheduledFor,
          }))}
        />
        <SimpleListCard
          title="Reservations"
          empty="No reservations yet."
          rows={client.reservations.map((item) => ({
            title: item.reference,
            subtitle: `${item.propertyTitle} · ${item.status}${item.marketerName ? ` · ${item.marketerName}` : ""}`,
            meta: "Reservation flow",
          }))}
        />
        <SimpleListCard
          title="Payments"
          empty="No payments yet."
          rows={client.payments.map((item) => ({
            title: item.reference,
            subtitle: `${item.amount} · ${item.status} · ${item.method}`,
            meta: item.receiptHref ? "Receipt available" : "No receipt yet",
          }))}
        />
      </div>

      <SimpleListCard
        title="Documents"
        empty="No client documents available."
        rows={client.documents.map((item) => ({
          title: item.fileName,
          subtitle: item.type,
          meta: item.href,
        }))}
      />
    </div>
  );
}

function SimpleListCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ title: string; subtitle: string; meta: string }>;
  empty: string;
}) {
  return (
    <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
      <h2 className="text-xl font-semibold text-[var(--ink-950)]">{title}</h2>
      <div className="mt-5 space-y-3">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${title}-${row.title}-${row.meta}`} className="rounded-3xl bg-[var(--sand-100)] p-4">
              <div className="text-sm font-semibold text-[var(--ink-950)]">{row.title}</div>
              <div className="mt-1 text-sm text-[var(--ink-600)]">{row.subtitle}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{row.meta}</div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-500)]">
            {empty}
          </div>
        )}
      </div>
    </Card>
  );
}
