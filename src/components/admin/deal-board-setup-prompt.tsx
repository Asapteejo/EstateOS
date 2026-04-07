"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { LoadSampleWorkspaceButton } from "@/components/admin/load-sample-workspace-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SetupMode = "sample" | "clean" | null;

export function DealBoardSetupPrompt({
  workspaceSlug,
  workspaceName,
  setupMode,
  showSuccess,
  showGuidance,
  hasProperties,
  hasDeals,
}: {
  workspaceSlug: string | null;
  workspaceName: string | null;
  setupMode: SetupMode;
  showSuccess: boolean;
  showGuidance: boolean;
  hasProperties: boolean;
  hasDeals: boolean;
}) {
  const storageKey = useMemo(
    () => `estateos:deal-board-prompt:${workspaceSlug ?? "workspace"}`,
    [workspaceSlug],
  );
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(storageKey) === "dismissed",
  );

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "dismissed");
    }
  }

  if (dismissed || (!showSuccess && !showGuidance)) {
    return null;
  }

  const headline = showSuccess
    ? `${workspaceName ?? "Your company workspace"} is ready`
    : "Take the next action that makes the board useful";
  const body =
    showSuccess && setupMode === "sample"
      ? "We created your company workspace and loaded a realistic sample pipeline so you can see deals, payments, and overdue collections immediately."
      : showSuccess
        ? "Your workspace has been created. Start by creating your first deal, or load a sample workspace if you want to see the full buyer-to-payment flow first."
        : !hasProperties
          ? "Start with one property and one deal. Once that is in place, the board becomes your operating system for payments and follow-up."
          : !hasDeals
            ? "Your listings are in place. Now create the first buyer deal so this board can track reservations, payment requests, and collections."
            : "Keep the workspace moving by sending the next payment request or loading sample data for a sharper walkthrough.";

  const primaryHref = hasProperties ? "/admin/deals/new" : "/admin/listings";
  const primaryLabel = hasProperties ? "Create your first deal" : "Add your first property";
  const secondaryHref = hasDeals ? "/admin/payments" : "/admin/listings";
  const secondaryLabel = hasDeals ? "Send payment request" : "Open listings";

  return (
    <Card className="rounded-[32px] border-[var(--line)] bg-[linear-gradient(135deg,#0d1f27,#154447)] p-6 text-white sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
            {showSuccess ? "Workspace ready" : "Next best action"}
          </div>
          <h3 className="text-2xl font-semibold sm:text-3xl">{headline}</h3>
          <p className="max-w-2xl text-sm leading-7 text-white/80">{body}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href={primaryHref}>
              <Button variant="secondary">{primaryLabel}</Button>
            </Link>
            <LoadSampleWorkspaceButton />
            <Link href={secondaryHref}>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                {secondaryLabel}
              </Button>
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="self-start rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </Card>
  );
}
