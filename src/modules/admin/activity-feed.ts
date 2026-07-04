import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { formatCurrency } from "@/lib/utils";

export type ActivityKind = "visitor" | "lead" | "payment" | "message" | "reservation";
export type ActivityTone = "brand" | "green" | "amber" | "neutral";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  /** Lucide icon name resolved by the component. */
  icon: string;
  title: string;
  detail: string;
  when: string;
  tone: ActivityTone;
};

type Ctx = { companyId: string | null };

const PER_SOURCE = 6;
const TOTAL = 14;

function fmtWhen(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Run a single feed source in isolation so one failing/absent table never
 *  breaks the whole feed (graceful degradation). */
async function safeSource<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    logError("Owner activity source failed; skipping.", buildSafeErrorLogContext(error));
    return [];
  }
}

/**
 * A read-only, company-wide "what's happening" feed for the owner/CEO: recent
 * visitors, leads, payments, buyer messages, and reservations merged into one
 * time-ordered timeline. Reinforces the oversight model — the owner monitors
 * activity here rather than doing the operational entry work.
 */
export async function getOwnerActivityFeed(ctx: Ctx): Promise<ActivityItem[]> {
  if (!featureFlags.hasDatabase || !ctx.companyId) return [];
  const companyId = ctx.companyId;

  const [visitors, leads, payments, messages, reservations] = await Promise.all([
    safeSource(() =>
      prisma.visitor.findMany({
        where: { companyId },
        orderBy: { checkedInAt: "desc" },
        take: PER_SOURCE,
        select: { id: true, fullName: true, purpose: true, checkedInAt: true },
      }),
    ),
    safeSource(() =>
      prisma.inquiry.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: { id: true, fullName: true, createdAt: true },
      }),
    ),
    safeSource(() =>
      prisma.payment.findMany({
        where: { companyId, status: "SUCCESS" },
        orderBy: { paidAt: "desc" },
        take: PER_SOURCE,
        select: { id: true, amount: true, paidAt: true, createdAt: true },
      }),
    ),
    safeSource(() =>
      prisma.message.findMany({
        where: { companyId, senderRole: "BUYER" },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: { id: true, senderName: true, createdAt: true },
      }),
    ),
    safeSource(() =>
      prisma.reservation.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: { id: true, reference: true, createdAt: true },
      }),
    ),
  ]);

  const items: Array<ActivityItem & { at: number }> = [];

  for (const v of visitors) {
    items.push({
      at: v.checkedInAt.getTime(),
      id: `visitor-${v.id}`,
      kind: "visitor",
      icon: "UserCheck",
      tone: "brand",
      title: `${v.fullName} checked in`,
      detail: v.purpose ?? "Walk-in visitor",
      when: fmtWhen(v.checkedInAt),
    });
  }
  for (const l of leads) {
    items.push({
      at: l.createdAt.getTime(),
      id: `lead-${l.id}`,
      kind: "lead",
      icon: "UserPlus",
      tone: "brand",
      title: `New lead: ${l.fullName}`,
      detail: "Inquiry received",
      when: fmtWhen(l.createdAt),
    });
  }
  for (const p of payments) {
    const at = p.paidAt ?? p.createdAt;
    items.push({
      at: at.getTime(),
      id: `payment-${p.id}`,
      kind: "payment",
      icon: "Wallet",
      tone: "green",
      title: "Payment received",
      detail: formatCurrency(toNumber(p.amount)),
      when: fmtWhen(at),
    });
  }
  for (const m of messages) {
    items.push({
      at: m.createdAt.getTime(),
      id: `message-${m.id}`,
      kind: "message",
      icon: "MessageSquare",
      tone: "neutral",
      title: `Message from ${m.senderName ?? "a buyer"}`,
      detail: "New buyer message",
      when: fmtWhen(m.createdAt),
    });
  }
  for (const r of reservations) {
    items.push({
      at: r.createdAt.getTime(),
      id: `reservation-${r.id}`,
      kind: "reservation",
      icon: "ClipboardCheck",
      tone: "amber",
      title: "New reservation",
      detail: r.reference,
      when: fmtWhen(r.createdAt),
    });
  }

  return items
    .sort((a, b) => b.at - a.at)
    .slice(0, TOTAL)
    .map(
      (entry): ActivityItem => ({
        id: entry.id,
        kind: entry.kind,
        icon: entry.icon,
        title: entry.title,
        detail: entry.detail,
        when: entry.when,
        tone: entry.tone,
      }),
    );
}
