"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState, AdminPanel, AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import type { SupportRequestListItem } from "@/modules/support/service";

function formatSupportCategory(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSyncState(value: SupportRequestListItem["syncStatus"]) {
  switch (value) {
    case "SYNCED":
      return "Synced";
    case "FAILED":
      return "Failed";
    case "SKIPPED":
      return "Skipped";
    case "MAX_RETRIES_EXCEEDED":
      return "Retry cap reached";
    default:
      return "Pending";
  }
}

function formatPriority(value: SupportRequestListItem["supportPriority"]) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatRevenueSnapshot(item: SupportRequestListItem) {
  if (!item.revenueSnapshotAmount || !item.revenueSnapshotCurrency) {
    return item.revenueTier === "NONE" ? "No successful payments yet" : item.revenueTier;
  }

  return `${item.revenueSnapshotCurrency} ${item.revenueSnapshotAmount} (${item.revenueTier.toLowerCase()})`;
}

export function SupportRequestManagement({
  items,
  highlightedRequestId,
}: {
  items: SupportRequestListItem[];
  highlightedRequestId?: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function retry(requestId: string) {
    setPendingId(requestId);

    try {
      const response = await fetch(`/api/admin/support/${requestId}/retry`, {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as
        | {
            data?: {
              alreadyLinked?: boolean;
              linearIssueIdentifier?: string | null;
            };
            error?: string;
          }
        | null;

      if (!response.ok) {
        toast.error(json?.error ?? "Unable to retry Linear sync.");
        return;
      }

      toast.success(
        json?.data?.alreadyLinked
          ? "Support request was already linked to Linear."
          : `Support request synced${json?.data?.linearIssueIdentifier ? ` as ${json.data.linearIssueIdentifier}` : ""}.`,
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <AdminEmptyState
        title="No support requests yet"
        description="Support submissions from the buyer portal will appear here for operator follow-up and Linear retry handling."
      />
    );
  }

  return (
    <AdminPanel
      title="Support requests"
      description="Review portal support submissions, open the synced Linear issue, and retry failed sync attempts without duplicating issues."
    >
      <div className="space-y-4">
        {highlightedRequestId ? (
          <AdminStateBanner
            tone="info"
            title={`Focused support request: ${highlightedRequestId}`}
            message="This request was linked from Linear or a direct operator handoff. The matching row is pinned first."
          />
        ) : null}

        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Reporter</th>
                <th>Sync</th>
                <th>Retry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const canRetry =
                  (item.syncStatus === "FAILED" || item.syncStatus === "SKIPPED") &&
                  !item.linearIssueId &&
                  !item.linearIssueIdentifier;
                const isHighlighted = item.id === highlightedRequestId;

                return (
                  <tr key={item.id} className={isHighlighted ? "bg-[var(--sand-50)]" : undefined}>
                    <td>
                      <div className="space-y-1">
                        <div className="font-medium text-[var(--ink-950)]">{item.subject}</div>
                        <div className="text-xs uppercase tracking-[0.14em] text-[var(--ink-400)]">
                          {formatSupportCategory(item.category)}  -  {item.id}
                        </div>
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-500)]">
                          Priority: {formatPriority(item.supportPriority)}
                        </div>
                        <div className="max-w-xl text-sm leading-6 text-[var(--ink-500)]">
                          {item.message}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1 text-sm text-[var(--ink-700)]">
                        <div>{item.reporterName ?? "Unknown reporter"}</div>
                        <div className="text-[var(--ink-500)]">{item.reporterEmail ?? "No email on file"}</div>
                        <div className="text-[var(--ink-500)]">{item.companyPlanLabel ?? "No active plan"}</div>
                        <div className="text-[var(--ink-500)]">{formatRevenueSnapshot(item)}</div>
                        <div className="text-[var(--ink-500)]">
                          {item.lastPaymentAt
                            ? `Last payment: ${new Date(item.lastPaymentAt).toLocaleString()}`
                            : "Last payment: none"}
                        </div>
                        <div className="text-[var(--ink-500)]">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1 text-sm text-[var(--ink-700)]">
                        <div className="font-medium text-[var(--ink-950)]">{formatSyncState(item.syncStatus)}</div>
                        {item.linearIssueIdentifier ? (
                          <div className="text-[var(--ink-500)]">{item.linearIssueIdentifier}</div>
                        ) : null}
                        {item.lastSyncError ? (
                          <div className="max-w-xs text-[var(--danger-700)]">{item.lastSyncError}</div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1 text-sm text-[var(--ink-700)]">
                        <div>Count: {item.retryCount}</div>
                        <div className="text-[var(--ink-500)]">
                          {item.lastRetryAt
                            ? `Last: ${new Date(item.lastRetryAt).toLocaleString()}`
                            : "No retries yet"}
                        </div>
                        <div className="text-[var(--ink-500)]">
                          {item.nextRetryAt
                            ? `Next: ${new Date(item.nextRetryAt).toLocaleString()}`
                            : item.syncStatus === "MAX_RETRIES_EXCEEDED"
                              ? "No more retries"
                              : "Ready now"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {item.linearIssueUrl ? (
                          <Link href={item.linearIssueUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">
                              Open Linear
                            </Button>
                          </Link>
                        ) : null}
                        {canRetry ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retry(item.id)}
                            disabled={pendingId === item.id}
                          >
                            {pendingId === item.id ? "Retrying..." : "Retry sync"}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPanel>
  );
}
