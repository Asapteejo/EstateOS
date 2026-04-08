"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DealBoardCard, DealBoardData } from "@/modules/admin/deal-board";
import { DealBoardActivationCard } from "@/components/admin/deal-board-activation-card";
import { DealBoardSetupPrompt } from "@/components/admin/deal-board-setup-prompt";
import { LoadSampleWorkspaceButton } from "@/components/admin/load-sample-workspace-button";
import { QuickPaymentRequestButton } from "@/components/admin/quick-payment-request-button";
import { TransactionFollowUpButton } from "@/components/admin/transaction-follow-up-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

type LaunchContext = {
  workspaceName: string | null;
  workspaceSlug: string | null;
  setupMode: "sample" | "clean" | null;
  showSuccess: boolean;
};

const stageTone: Record<
  DealBoardCard["stage"],
  {
    columnClass: string;
    cardClass: string;
    badgeClass: string;
  }
> = {
  NEW_LEADS: {
    columnClass: "border-[var(--line)] bg-white",
    cardClass: "border-[var(--line)] bg-white",
    badgeClass: "bg-[var(--sand-100)] text-[var(--ink-700)]",
  },
  INSPECTIONS: {
    columnClass: "border-amber-200 bg-amber-50/80",
    cardClass: "border-amber-200 bg-white",
    badgeClass: "bg-amber-100 text-amber-800",
  },
  RESERVED: {
    columnClass: "border-orange-200 bg-orange-50/80",
    cardClass: "border-orange-200 bg-white",
    badgeClass: "bg-orange-100 text-orange-800",
  },
  PAYMENT_PENDING: {
    columnClass: "border-sky-200 bg-sky-50/80",
    cardClass: "border-sky-200 bg-white",
    badgeClass: "bg-sky-100 text-sky-800",
  },
  PAID: {
    columnClass: "border-emerald-200 bg-emerald-50/80",
    cardClass: "border-emerald-200 bg-white",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
  OVERDUE: {
    columnClass: "border-rose-200 bg-rose-50/80",
    cardClass: "border-rose-200 bg-rose-50",
    badgeClass: "bg-rose-600 text-white",
  },
};

function InspectPill({ label }: { label: string }) {
  return (
    <div className="inline-flex rounded-full border border-dashed border-[var(--line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
      Inspect: {label}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <Card
      className={cn(
        "rounded-[28px] p-5",
        tone === "danger" && "border-rose-200 bg-rose-50",
        tone === "success" && "border-emerald-200 bg-emerald-50",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{detail}</p>
    </Card>
  );
}

function EmptyBoardState({ readOnly, demoCtaHref }: { readOnly: boolean; demoCtaHref: string }) {
  return (
    <Card className="rounded-[32px] border-dashed border-[var(--line)] bg-[var(--sand-50)] p-8 sm:p-10">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
          Deal Board
        </div>
        <h3 className="mt-4 text-3xl font-semibold text-[var(--ink-950)]">
          Track every buyer from first inquiry to final payment
        </h3>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-600)] sm:text-base">
          Your Deal Board shows what is new, what is reserved, what has been paid, and what needs
          collections follow-up. Start clean, or load a sample workspace to see the operating flow
          immediately.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href={readOnly ? demoCtaHref : "/admin/deals/new"}>
            <Button>{readOnly ? "Start your workspace" : "Create your first deal"}</Button>
          </Link>
          {readOnly ? null : <LoadSampleWorkspaceButton />}
          <Link href={readOnly ? "/platform/pricing" : "/admin/listings"}>
            <Button variant="outline">{readOnly ? "See pricing" : "Add your first property"}</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function BoardCard({
  card,
  highlighted,
  onFollowUpSaved,
  readOnly = false,
  demoCtaHref = "/app/onboarding",
  inspect = false,
}: {
  card: DealBoardCard;
  highlighted: boolean;
  onFollowUpSaved: () => void;
  readOnly?: boolean;
  demoCtaHref?: string;
  inspect?: boolean;
}) {
  const tone = stageTone[card.stage];
  const isOverdue = card.stage === "OVERDUE";

  return (
    <div
      className={cn(
        "rounded-[26px] border p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition",
        tone.cardClass,
        highlighted && "ring-2 ring-emerald-300 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]",
      )}
    >
      {inspect && card.stage === "OVERDUE" ? (
        <div className="mb-3">
          <InspectPill label="Overdue Queue / Follow-up State" />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-[var(--ink-950)]">{card.buyerName}</div>
          <div className="mt-1 text-sm text-[var(--ink-600)]">{card.propertyLabel}</div>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tone.badgeClass)}>
          {isOverdue ? "Overdue" : card.stageLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[18px] bg-white/80 p-3 ring-1 ring-black/5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
            Deal value
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--ink-950)]">
            {formatCurrency(card.totalValue)}
          </div>
        </div>
        <div className="rounded-[18px] bg-white/80 p-3 ring-1 ring-black/5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
            Amount paid
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-700">
            {formatCurrency(card.amountPaid)}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mt-3 rounded-[20px] p-3",
          isOverdue ? "bg-rose-100 text-rose-900" : "bg-[var(--sand-50)] text-[var(--ink-900)]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
              Outstanding
            </div>
            <div className={cn("mt-1 text-base font-semibold", isOverdue && "text-rose-700")}>
              {formatCurrency(card.outstandingBalance)}
            </div>
          </div>
          {isOverdue && card.overdueDays ? (
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              {card.overdueDays} day{card.overdueDays === 1 ? "" : "s"} overdue
            </div>
          ) : null}
        </div>
        {card.dueLabel ? (
          <div className="mt-2 text-sm text-[var(--ink-600)]">
            {isOverdue ? "Payment was due" : "Next payment due"} {card.dueLabel}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 text-sm text-[var(--ink-600)]">
        <div>
          <span className="font-semibold text-[var(--ink-900)]">Owner:</span> {card.ownerName}{" "}
          <span className="text-[var(--ink-500)]">· {card.ownerRole}</span>
        </div>
        <div>
          <span className="font-semibold text-[var(--ink-900)]">Latest activity:</span>{" "}
          {card.latestActivity}
        </div>
        <div>
          <span className="font-semibold text-[var(--ink-900)]">Next action:</span> {card.nextAction}
        </div>
        {isOverdue ? (
          <div className="rounded-[18px] border border-rose-200 bg-white/70 p-3 text-sm">
            <div className="font-semibold text-rose-700">Collections follow-up</div>
            <div className="mt-1 text-[var(--ink-700)]">
              {card.followUpStatus ? `Status: ${card.followUpStatus}` : "Status: Not logged yet"}
            </div>
            <div className="mt-1 text-[var(--ink-600)]">
              {card.lastFollowedUpLabel
                ? `Last contacted: ${card.lastFollowedUpLabel}`
                : "No collections contact has been logged yet."}
            </div>
            {card.nextFollowUpLabel ? (
              <div className="mt-1 text-[var(--ink-600)]">Next follow-up: {card.nextFollowUpLabel}</div>
            ) : null}
            {card.followUpNote ? (
              <div className="mt-2 rounded-[14px] bg-rose-50 px-3 py-2 text-[var(--ink-700)]">
                {card.followUpNote}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={readOnly ? demoCtaHref : card.primaryAction.href}>
          <Button size="sm">{card.primaryAction.label}</Button>
        </Link>
        <Link href={readOnly ? demoCtaHref : card.secondaryAction.href}>
          <Button size="sm" variant="outline">
            {card.secondaryAction.label}
          </Button>
        </Link>
      </div>
      {readOnly ? (
        <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-500)]">
          Read-only in demo
        </div>
      ) : null}

      {card.clientId && card.stage !== "PAID" && card.outstandingBalance > 0 ? (
        <div className="mt-3">
          {inspect ? (
            <div className="mb-2">
              <InspectPill label="Payment Request Action" />
            </div>
          ) : null}
          <QuickPaymentRequestButton
            userId={card.clientId}
            transactionId={card.id}
            propertyLabel={card.propertyLabel}
            outstandingBalance={card.outstandingBalance}
            onSent={onFollowUpSaved}
            readOnly={readOnly}
            ctaHref={demoCtaHref}
          />
        </div>
      ) : null}

      {isOverdue ? (
        <div className="mt-3">
          <TransactionFollowUpButton
            transactionId={card.id}
            onUpdated={onFollowUpSaved}
            readOnly={readOnly}
            ctaHref={demoCtaHref}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DealBoardView({
  board,
  launch,
  highlightDealId,
  mode = "live",
  inspect = false,
  demoCtaHref = "/app/onboarding",
}: {
  board: DealBoardData;
  launch?: LaunchContext;
  highlightDealId?: string | null;
  mode?: "live" | "demo";
  inspect?: boolean;
  demoCtaHref?: string;
}) {
  const router = useRouter();
  const isDemo = mode === "demo";
  const [activeFilter, setActiveFilter] = useState<"ALL" | "OVERDUE">("ALL");
  const [highlightedId, setHighlightedId] = useState<string | null>(() => highlightDealId ?? null);

  useEffect(() => {
    if (!highlightedId) {
      return;
    }

    const timeout = window.setTimeout(() => setHighlightedId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedId]);

  const visibleColumns = useMemo(
    () =>
      activeFilter === "OVERDUE"
        ? board.columns.filter((column) => column.key === "OVERDUE")
        : board.columns,
    [activeFilter, board.columns],
  );

  const hasProperties = board.checklist.steps.some((step) => step.key === "property" && step.complete);
  const hasDeals = board.summary.totalDeals > 0;
  const showGuidance = !hasDeals || board.summary.overdueCount > 0;
  const nextActivationStep = board.activation.steps.find((step) => !step.complete);

  return (
    <div className="space-y-6">
      {!isDemo ? (
        <DealBoardSetupPrompt
          workspaceSlug={launch?.workspaceSlug ?? null}
          workspaceName={launch?.workspaceName ?? null}
          setupMode={launch?.setupMode ?? null}
          showSuccess={launch?.showSuccess ?? false}
          showGuidance={showGuidance}
          hasProperties={hasProperties}
          hasDeals={hasDeals}
        />
      ) : null}

      <DealBoardActivationCard
        companySlug={launch?.workspaceSlug ?? "demo-workspace"}
        activation={board.activation}
        overdueCount={board.summary.overdueCount}
        onOpenCollectionsMode={() => setActiveFilter("OVERDUE")}
        readOnly={isDemo}
        ctaHref={demoCtaHref}
        inspect={inspect}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card className="rounded-[32px] p-6 sm:p-7">
          {inspect ? (
            <div className="mb-4">
              <InspectPill label="Collections Summary" />
            </div>
          ) : null}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
                Collections summary
              </div>
              <h2 className="text-2xl font-semibold text-[var(--ink-950)]">
                See what is due, collected, and overdue at a glance
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--ink-600)]">
                {isDemo
                  ? "This sample workspace shows how a developer sales team tracks due money, paid deals, and overdue collections in one place."
                  : "The board is built to help you push money forward. Keep overdue deals impossible to ignore and move active buyers toward payment quickly."}
              </p>
            </div>
            <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--sand-50)] p-1">
              <button
                type="button"
                onClick={() => setActiveFilter("ALL")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  activeFilter === "ALL"
                    ? "bg-white text-[var(--ink-950)] shadow-sm"
                    : "text-[var(--ink-600)]",
                )}
              >
                All deals
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("OVERDUE")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  activeFilter === "OVERDUE"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-[var(--ink-600)]",
                )}
              >
                Collections Mode
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Total due"
              value={formatCurrency(board.summary.totalAmountDue)}
              detail={`${board.summary.totalDeals} active deals across the board.`}
            />
            <MetricCard
              label="Total collected"
              value={formatCurrency(board.summary.totalAmountCollected)}
              detail={`${board.summary.reservationToPaymentConversion}% of reservations have reached payment.`}
              tone="success"
            />
            <MetricCard
              label="Total overdue"
              value={formatCurrency(board.summary.overdueAmount)}
              detail={`${board.summary.overdueCount} deal${board.summary.overdueCount === 1 ? "" : "s"} need collections follow-up now.`}
              tone="danger"
            />
          </div>
        </Card>

        <Card className="rounded-[32px] p-6 sm:p-7">
          {inspect ? (
            <div className="mb-4">
              <InspectPill label="Deal Board" />
            </div>
          ) : null}
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
            Revenue pulse
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[var(--ink-950)]">
            Keep the next revenue step obvious
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">
            {isDemo
              ? "The demo walks through the same operating loop real teams use: open deals, send payment requests, and work overdue collections."
              : nextActivationStep
                ? nextActivationStep.description
                : "Your first three activation milestones are complete. Keep collections and follow-up moving."}
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--sand-50)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                Inquiry → reservation
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--ink-950)]">
                {board.summary.inquiryToReservationConversion}%
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--sand-50)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                Reservation → payment
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--ink-950)]">
                {board.summary.reservationToPaymentConversion}%
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={isDemo ? demoCtaHref : nextActivationStep?.href ?? "/admin/deals/new"}>
              <Button>{isDemo ? "Start your workspace" : nextActivationStep?.ctaLabel ?? "Create your first deal"}</Button>
            </Link>
            <Link href={isDemo ? "/platform/pricing" : "/admin/payments"}>
              <Button variant="outline">{isDemo ? "See pricing" : "Open payments"}</Button>
            </Link>
          </div>
        </Card>
      </div>

      {board.summary.totalDeals === 0 ? (
        <EmptyBoardState readOnly={isDemo} demoCtaHref={demoCtaHref} />
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4 xl:grid-cols-2 3xl:grid-cols-3">
          {visibleColumns.map((column) => (
            <Card key={column.key} className={cn("rounded-[32px] p-5", stageTone[column.key].columnClass)}>
              {inspect && column.key === "OVERDUE" ? (
                <div className="mb-4">
                  <InspectPill label="Overdue Queue" />
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[var(--ink-950)]">{column.label}</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-600)]">{column.subtitle}</p>
                </div>
                <div
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    column.key === "OVERDUE"
                      ? "bg-rose-600 text-white"
                      : "bg-white text-[var(--ink-700)] ring-1 ring-black/5",
                  )}
                >
                  {column.cards.length}
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {column.cards.length > 0 ? (
                  column.cards.map((card) => (
                    <BoardCard
                      key={card.id}
                      card={card}
                      highlighted={highlightedId === card.id}
                      onFollowUpSaved={() => router.refresh()}
                      readOnly={isDemo}
                      demoCtaHref={demoCtaHref}
                      inspect={inspect}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white/70 p-5 text-sm leading-7 text-[var(--ink-600)]">
                    {column.key === "OVERDUE"
                      ? "No overdue deals right now. Keep payment requests moving before they slip."
                      : column.key === "PAID"
                        ? "Paid deals will appear here once buyers complete their payments."
                        : "No deals in this stage yet. Push the next buyer action to move revenue forward."}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card className="rounded-[32px] p-6 sm:p-7">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
            Recent activity
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[var(--ink-950)]">
            What changed in the revenue workflow
          </h3>
          <div className="mt-5 space-y-4">
            {board.recentEvents.length > 0 ? (
              board.recentEvents.map((event) => (
                <div key={event.id} className="rounded-[22px] border border-[var(--line)] bg-[var(--sand-50)] p-4">
                  <div className="text-sm font-semibold text-[var(--ink-950)]">{event.title}</div>
                  <div className="mt-1 text-sm text-[var(--ink-600)]">{event.detail}</div>
                  <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    {event.createdAt}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-[var(--sand-50)] p-5 text-sm leading-7 text-[var(--ink-600)]">
                Product activity will appear here as your team creates deals, sends payment requests,
                and records collections.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
