"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState, AdminPanel, AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import type { IncidentListItem } from "@/modules/incidents/service";

function formatLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatEscalationStatus(value: IncidentListItem["escalationStatus"]) {
  switch (value) {
    case "ESCALATED":
      return "Escalated";
    case "SUPPRESSED":
      return "Stored only";
    case "IGNORED":
      return "Ignored";
    case "RESOLVED":
      return "Resolved";
    case "REOPENED":
      return "Reopened";
    default:
      return "Pending";
  }
}

export function IncidentManagement({
  items,
  highlightedFingerprint,
}: {
  items: IncidentListItem[];
  highlightedFingerprint?: string | null;
}) {
  const router = useRouter();
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  async function runAction(input: {
    incidentId: string;
    route: "resolve" | "ignore" | "unignore";
    successMessage: string;
    failureMessage: string;
  }) {
    const actionKey = `${input.incidentId}:${input.route}`;
    setPendingActionKey(actionKey);

    try {
      const response = await fetch(`/api/admin/incidents/${input.incidentId}/${input.route}`, {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as
        | {
            error?: string;
          }
        | null;

      if (!response.ok) {
        toast.error(json?.error ?? input.failureMessage);
        return;
      }

      toast.success(input.successMessage);
      router.refresh();
    } finally {
      setPendingActionKey(null);
    }
  }

  async function markResolved(incidentId: string) {
    await runAction({
      incidentId,
      route: "resolve",
      successMessage: "Incident marked as resolved.",
      failureMessage: "Unable to mark incident as resolved.",
    });
  }

  async function markIgnored(incidentId: string) {
    await runAction({
      incidentId,
      route: "ignore",
      successMessage: "Incident marked as ignored.",
      failureMessage: "Unable to mark incident as ignored.",
    });
  }

  async function markUnignored(incidentId: string) {
    await runAction({
      incidentId,
      route: "unignore",
      successMessage: "Incident restored to active triage.",
      failureMessage: "Unable to remove ignore from incident.",
    });
  }

  if (items.length === 0) {
    return (
      <AdminEmptyState
        title="No incidents recorded"
        description="High-signal failures will appear here once EstateOS starts aggregating repeated operational incidents."
      />
    );
  }

  return (
    <AdminPanel
      title="Observed incidents"
      description="Grouped operational failures are stored here by fingerprint so repeated incidents can be escalated once, not noisily."
    >
      <div className="space-y-4">
        {highlightedFingerprint ? (
          <AdminStateBanner
            tone="info"
            title={`Focused incident: ${highlightedFingerprint}`}
            message="This fingerprint is pinned first so operators can match the incident with PostHog, logs, and the linked Linear issue."
          />
        ) : null}

        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Context</th>
                <th>Volume</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const highlighted = item.fingerprint === highlightedFingerprint;
                const canResolve =
                  item.escalationStatus !== "RESOLVED" &&
                  item.escalationStatus !== "IGNORED";
                const canIgnore = item.escalationStatus !== "IGNORED";
                const canUnignore = item.escalationStatus === "IGNORED";
                const resolveActionKey = `${item.id}:resolve`;
                const ignoreActionKey = `${item.id}:ignore`;
                const unignoreActionKey = `${item.id}:unignore`;

                return (
                  <tr key={item.id} className={highlighted ? "bg-[var(--sand-50)]" : undefined}>
                    <td>
                      <div className="space-y-1">
                        <div className="font-medium text-[var(--ink-950)]">{item.title}</div>
                        <div className="text-xs uppercase tracking-[0.14em] text-[var(--ink-400)]">
                          {item.fingerprint}
                        </div>
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-500)]">
                          {formatLabel(item.severity)}  /  {formatLabel(item.source)}  /  {formatLabel(item.eventGroup)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1 text-sm text-[var(--ink-700)]">
                        <div>Env: {item.environment}</div>
                        <div>Version: {item.eventVersion}</div>
                        <div>Route: {item.lastRoute ?? "Unknown"}</div>
                        <div>Support: {item.supportRequestId ?? "None"}</div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1 text-sm text-[var(--ink-700)]">
                        <div>Total: {item.occurrenceCount}</div>
                        <div>Recent {15}m: {item.recentWindowOccurrenceCount}</div>
                        <div>Companies: {item.affectedCompanyCount}</div>
                        <div>Recent companies: {item.recentWindowCompanyCount}</div>
                        <div className="text-[var(--ink-500)]">
                          First: {new Date(item.firstSeenAt).toLocaleString()}
                        </div>
                        <div className="text-[var(--ink-500)]">
                          Last: {new Date(item.lastSeenAt).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1 text-sm text-[var(--ink-700)]">
                        <div className="font-medium text-[var(--ink-950)]">
                          {formatEscalationStatus(item.escalationStatus)}
                        </div>
                        <div className="text-[var(--ink-500)]">
                          {item.lastEscalationReason ?? "No escalation decision recorded yet."}
                        </div>
                        {item.escalatedAt ? (
                          <div className="text-[var(--ink-500)]">
                            Escalated: {new Date(item.escalatedAt).toLocaleString()}
                          </div>
                        ) : null}
                        {item.nextEligibleEscalationAt ? (
                          <div className="text-[var(--ink-500)]">
                            Cooldown until: {new Date(item.nextEligibleEscalationAt).toLocaleString()}
                          </div>
                        ) : null}
                        {item.linearIssueIdentifier ? (
                          <div className="text-[var(--ink-500)]">{item.linearIssueIdentifier}</div>
                        ) : null}
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
                        {canResolve ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markResolved(item.id)}
                            disabled={pendingActionKey === resolveActionKey}
                          >
                            {pendingActionKey === resolveActionKey ? "Updating..." : "Mark resolved"}
                          </Button>
                        ) : null}
                        {canIgnore ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markIgnored(item.id)}
                            disabled={pendingActionKey === ignoreActionKey}
                          >
                            {pendingActionKey === ignoreActionKey ? "Updating..." : "Mark ignored"}
                          </Button>
                        ) : null}
                        {canUnignore ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markUnignored(item.id)}
                            disabled={pendingActionKey === unignoreActionKey}
                          >
                            {pendingActionKey === unignoreActionKey ? "Updating..." : "Unignore"}
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
