"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AdminAttentionBadge, AdminEmptyState, AdminStateBanner, StatCard } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PrintButton } from "@/components/shared/print-button";
import { compareAttentionPriority, getAttentionTone, workflowVocabulary } from "@/modules/admin/workflow-vocabulary";
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

  function isDirty(item: AdminClientProfile["wishlistItems"][number]) {
    const draft = drafts[item.id];
    return (
      draft.assignedStaffId !== (item.assignedStaffId ?? "") ||
      draft.followUpStatus !== item.followUpStatus ||
      draft.followUpNote !== (item.followUpNote ?? "")
    );
  }

  function resetWishlist(item: AdminClientProfile["wishlistItems"][number]) {
    setDrafts((current) => ({
      ...current,
      [item.id]: {
        assignedStaffId: item.assignedStaffId ?? "",
        followUpStatus: item.followUpStatus,
        followUpNote: item.followUpNote ?? "",
      },
    }));
  }

  function getAttentionState(item: AdminClientProfile["wishlistItems"][number]) {
    return workflowVocabulary.clients.attention({
      followUpStatus: drafts[item.id]?.followUpStatus ?? item.followUpStatus,
      assignedStaffId: drafts[item.id]?.assignedStaffId ?? item.assignedStaffId,
    });
  }

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

  const sortedWishlistItems = client.wishlistItems
    .slice()
    .sort((left, right) => {
      const attentionComparison = compareAttentionPriority(
        getAttentionState(left)?.priority,
        getAttentionState(right)?.priority,
      );

      if (attentionComparison !== 0) {
        return attentionComparison;
      }

      return new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime();
    });

  return (
    <div className="space-y-8">
      <div className="flex justify-end print:hidden">
        <PrintButton label="Print Buyer Profile" />
      </div>
      <section className="hidden print:block">
        <PrintableAdminBuyerProfile client={client} />
      </section>
      <div className="print:hidden">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          ["Wishlist items", String(client.summary.wishlistCount)],
          ["Reservations", String(client.summary.reservationCount)],
          ["Payments", String(client.summary.paymentCount)],
          ["Outstanding", client.summary.outstandingBalance],
          ["Latest activity", client.summary.latestActivity],
        ].map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
        <Card className="admin-surface p-6">
          <h2 className="text-xl font-semibold text-[var(--ink-950)]">Client profile</h2>
          <div className="mt-5 space-y-4 text-sm text-[var(--ink-600)]">
            <div className="flex items-center gap-3">
              <Avatar name={client.name} imageUrl={client.profileImageUrl} size="lg" />
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">Client</div>
                <div className="mt-1 text-lg font-semibold text-[var(--ink-950)]">{client.name}</div>
              </div>
            </div>
            <div className="break-words">{client.email}</div>
            {client.phone ? <div className="numeric">{client.phone}</div> : null}
            <div>KYC: <strong className="text-[var(--ink-900)]">{client.kycStatus}</strong></div>
            <div>Assigned marketer: <strong className="text-[var(--ink-900)]">{client.assignedMarketer ?? "Unassigned"}</strong></div>
            <div>Location: <strong className="text-[var(--ink-900)]">{[client.city, client.state].filter(Boolean).join(", ") || "Not completed"}</strong></div>
            <div>Occupation: <strong className="text-[var(--ink-900)]">{client.occupation ?? "Not completed"}</strong></div>
          </div>
        </Card>

        <Card className="admin-surface p-6">
          <h2 className="text-xl font-semibold text-[var(--ink-950)]">Recent client activity</h2>
          <div className="mt-5 space-y-4">
            {client.timeline.map((event) => (
              <div key={`${event.title}-${event.time}`} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] p-4">
                <div className="text-sm font-semibold text-[var(--ink-950)]">{event.title}</div>
                <div className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{event.detail}</div>
                <div className="numeric mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{event.time}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="admin-surface p-6">
        <h2 className="text-xl font-semibold text-[var(--ink-950)]">Wishlist intent and follow-up</h2>
        <div className="mt-5 space-y-4">
          {sortedWishlistItems.map((item) => {
            const attention = getAttentionState(item);
            const followUpStatus = drafts[item.id]?.followUpStatus ?? item.followUpStatus;

            return (
            <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle,var(--line))] bg-white p-5 shadow-[var(--shadow-xs)]">
              <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-[var(--ink-950)]">{item.propertyTitle}</div>
                  <div className="numeric mt-1 text-sm text-[var(--ink-500)]">
                    Saved {item.savedAt} - {item.timeLabel}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                  <Badge className="whitespace-nowrap">{item.status}</Badge>
                  <Badge>
                    {workflowVocabulary.clients.followUpStatusLabels[
                      followUpStatus as keyof typeof workflowVocabulary.clients.followUpStatusLabels
                    ] ?? followUpStatus}
                  </Badge>
                  {attention ? (
                    <AdminAttentionBadge
                      label={attention.label}
                      tone={getAttentionTone(attention.priority)}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <select
                  className="admin-focus admin-interactive h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
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
                  className="admin-focus admin-interactive h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
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
                  <option value="NONE">{workflowVocabulary.clients.followUpStatusLabels.NONE}</option>
                  <option value="PENDING_CALL">{workflowVocabulary.clients.followUpStatusLabels.PENDING_CALL}</option>
                  <option value="CONTACTED">{workflowVocabulary.clients.followUpStatusLabels.CONTACTED}</option>
                  <option value="FOLLOW_UP_SCHEDULED">{workflowVocabulary.clients.followUpStatusLabels.FOLLOW_UP_SCHEDULED}</option>
                  <option value="CLOSED">{workflowVocabulary.clients.followUpStatusLabels.CLOSED}</option>
                </select>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {item.whatsappHref ? (
                    <a href={item.whatsappHref} target="_blank" rel="noreferrer">
                      <Button variant="outline">WhatsApp</Button>
                    </a>
                  ) : null}
                  <Button variant="outline" onClick={() => resetWishlist(item)} disabled={!isDirty(item) || pendingId === item.id}>
                    Reset
                  </Button>
                  <Button onClick={() => saveWishlistFollowUp(item.id)} disabled={pendingId === item.id || !isDirty(item)}>
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

              <div className="mt-4">
                <AdminStateBanner
                  tone={isDirty(item) ? "warning" : "info"}
                  title={isDirty(item) ? "Unsaved follow-up changes" : "Next best action"}
                  message={
                    isDirty(item)
                      ? "Review owner, follow-up status, and note together, then save once."
                      : workflowVocabulary.clients.nextAction(followUpStatus)
                  }
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/properties/${item.propertySlug}`}>
                  <Button variant="ghost">Open property</Button>
                </Link>
                {item.assignedStaffName ? (
                  <div className="self-center text-sm text-[var(--ink-500)]">Owner: {item.assignedStaffName}</div>
                ) : null}
              </div>
            </div>
          )})}
          {client.wishlistItems.length === 0 ? (
            <AdminEmptyState
              title="No wishlist activity yet"
              description="Saved properties will appear here once the client begins showing intent on the public site or buyer portal."
            />
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SimpleListCard
          title="Inquiries"
          emptyTitle="No inquiries yet"
          rows={client.inquiries.map((item) => ({
            title: item.propertyTitle,
            subtitle: `${item.status} - ${item.assignedStaffName}`,
            meta: item.createdAt,
          }))}
        />
        <SimpleListCard
          title="Inspections"
          emptyTitle="No inspections yet"
          rows={client.inspections.map((item) => ({
            title: item.propertyTitle,
            subtitle: `${item.status} - ${item.assignedStaffName}`,
            meta: item.scheduledFor,
          }))}
        />
        <SimpleListCard
          title="Reservations"
          emptyTitle="No reservations yet"
          rows={client.reservations.map((item) => ({
            title: item.reference,
            subtitle: `${item.propertyTitle} - ${item.status}${item.marketerName ? ` - ${item.marketerName}` : ""}`,
            meta: "Reservation flow",
          }))}
        />
        <SimpleListCard
          title="Payments"
          emptyTitle="No payments yet"
          rows={client.payments.map((item) => ({
            title: item.reference,
            subtitle: `${item.amount} - ${item.status} - ${item.method}`,
            meta: item.receiptHref ? "Receipt available" : "No receipt yet",
          }))}
        />
      </div>

      <SimpleListCard
        title="Documents"
        emptyTitle="No client documents available"
        rows={client.documents.map((item) => ({
          title: item.fileName,
          subtitle: `${item.type}${item.status ? ` - ${item.status}` : ""}`,
          meta: item.rejectionReason ?? "Private tenant document",
        }))}
      />
      </div>
    </div>
  );
}

function PrintableAdminBuyerProfile({ client }: { client: AdminClientProfile }) {
  const generatedAt = new Date().toLocaleString();
  const location = [client.addressLine1, client.city, client.state, client.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl bg-white text-black">
      <div className="flex items-center justify-between border-b border-black/20 pb-5">
        <div>
          <div className="text-2xl font-semibold">{client.tenantName}</div>
          <div className="mt-1 text-sm">Tenant buyer profile</div>
        </div>
        {client.tenantLogoUrl ? (
          <Image src={client.tenantLogoUrl} alt={client.tenantName} width={56} height={56} unoptimized className="h-14 w-14 object-contain" />
        ) : null}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[0.35fr_0.65fr]">
        <div className="space-y-3">
          {client.profileImageUrl ? (
            <Image src={client.profileImageUrl} alt={client.name} width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" />
          ) : null}
          <div>
            <div className="text-xl font-semibold">{client.name}</div>
            <div className="text-sm">{client.email}</div>
            <div className="text-sm">{client.phone ?? "No phone on file"}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            ["KYC status", client.kycStatus],
            ["Location", location || "Not completed"],
            ["Occupation", client.occupation ?? "Not completed"],
            ["Assigned marketer", client.assignedMarketer ?? "Unassigned"],
            ["Outstanding balance", client.summary.outstandingBalance],
            ["Date generated", generatedAt],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-black/10 pb-2">
              <dt className="text-xs uppercase tracking-wide text-black/60">{label}</dt>
              <dd className="mt-1 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <PrintSummary title="Submitted documents" rows={client.documents.map((item) => `${item.fileName} - ${item.status ?? item.type}${item.rejectionReason ? ` - ${item.rejectionReason}` : ""}`)} />
      <PrintSummary title="Reservations" rows={client.reservations.map((item) => `${item.reference} - ${item.propertyTitle} - ${item.status}`)} />
      <PrintSummary title="Payments" rows={client.payments.map((item) => `${item.reference} - ${item.amount} - ${item.status}`)} />
    </div>
  );
}

function PrintSummary({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.length > 0 ? rows.map((row) => (
          <div key={`${title}-${row}`} className="border-b border-black/10 pb-2 text-sm">
            {row}
          </div>
        )) : <div className="text-sm">None recorded.</div>}
      </div>
    </section>
  );
}

function SimpleListCard({
  title,
  rows,
  emptyTitle,
}: {
  title: string;
  rows: Array<{ title: string; subtitle: string; meta: string }>;
  emptyTitle: string;
}) {
  return (
    <Card className="admin-surface p-6">
      <h2 className="text-xl font-semibold text-[var(--ink-950)]">{title}</h2>
      <div className="mt-5 space-y-3">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${title}-${row.title}-${row.meta}`} className="rounded-[var(--radius-md)] border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] p-4">
              <div className="break-words text-sm font-semibold text-[var(--ink-950)]">{row.title}</div>
              <div className="mt-1 break-words text-sm text-[var(--ink-600)]">{row.subtitle}</div>
              <div className="numeric mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{row.meta}</div>
            </div>
          ))
        ) : (
          <AdminEmptyState
            title={emptyTitle}
            description="Nothing is currently recorded in this part of the client journey."
          />
        )}
      </div>
    </Card>
  );
}
