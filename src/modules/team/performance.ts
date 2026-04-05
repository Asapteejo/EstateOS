import { Prisma } from "@prisma/client";
import { startOfMonth, subDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findManyForTenant } from "@/lib/tenancy/db";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type MarketerRankingSnapshotDelegate = {
  findMany: (args?: unknown) => Promise<unknown>;
  upsert: (args?: unknown) => Promise<unknown>;
};

type AttributedActivityRecord = {
  explicitMarketerId?: string | null;
  fallbackUserId?: string | null;
  fallbackPropertyId?: string | null;
};

type FallbackAttributionCandidate = {
  marketerId: string;
  userId: string;
  propertyId: string;
  happenedAt: Date;
  source: "inspection" | "inquiry";
};

type TeamMemberPerformanceRow = {
  id: string;
  slug: string;
  fullName: string;
  title: string;
  avatarUrl: string | null;
  isActive: boolean;
  isPublished: boolean;
};

export type MarketerPerformanceMetrics = {
  wishlistAdds: number;
  qualifiedInquiries: number;
  inspectionsHandled: number;
  reservations: number;
  successfulPayments: number;
  completedDeals: number;
};

export type MarketerPerformanceEntry = {
  id: string;
  slug: string;
  fullName: string;
  title: string;
  avatarUrl: string | null;
  isActive: boolean;
  isPublished: boolean;
  monthlyScore: number;
  starRating: number;
  rank: number;
  summary: string;
  metrics: MarketerPerformanceMetrics;
};

export type MarketerPerformanceTrend = {
  direction: "up" | "down" | "flat";
  scoreDelta: number;
  rankDelta: number;
  previousSnapshotDate: string;
};

export type AdminMarketerPerformanceRow = MarketerPerformanceEntry & {
  trend: MarketerPerformanceTrend | null;
};

export const MARKETER_SCORE_WEIGHTS = {
  // Softer intent sits lower than deal-closing signals.
  wishlistAdds: 1,
  qualifiedInquiries: 2,
  inspectionsHandled: 3,
  reservations: 4,
  successfulPayments: 6,
  completedDeals: 8,
} as const;

export function buildMarketerPerformanceScore(input: MarketerPerformanceMetrics) {
  return (
    input.wishlistAdds * MARKETER_SCORE_WEIGHTS.wishlistAdds +
    input.qualifiedInquiries * MARKETER_SCORE_WEIGHTS.qualifiedInquiries +
    input.inspectionsHandled * MARKETER_SCORE_WEIGHTS.inspectionsHandled +
    input.reservations * MARKETER_SCORE_WEIGHTS.reservations +
    input.successfulPayments * MARKETER_SCORE_WEIGHTS.successfulPayments +
    input.completedDeals * MARKETER_SCORE_WEIGHTS.completedDeals
  );
}

export function buildMarketerStarRating(score: number) {
  return Math.max(3, Math.min(5, Number((3 + Math.sqrt(Math.max(score, 0)) / 3).toFixed(1))));
}

function buildFallbackAttributionKey(userId: string, propertyId: string) {
  return `${userId}:${propertyId}`;
}

export function buildFallbackAttributionIndex(candidates: FallbackAttributionCandidate[]) {
  const index = new Map<string, FallbackAttributionCandidate>();

  for (const candidate of candidates) {
    const key = buildFallbackAttributionKey(candidate.userId, candidate.propertyId);
    const current = index.get(key);

    if (!current) {
      index.set(key, candidate);
      continue;
    }

    if (candidate.happenedAt > current.happenedAt) {
      index.set(key, candidate);
      continue;
    }

    if (
      candidate.happenedAt.getTime() === current.happenedAt.getTime() &&
      candidate.source === "inspection" &&
      current.source === "inquiry"
    ) {
      index.set(key, candidate);
    }
  }

  return index;
}

export function resolveAttributedMarketerId(
  input: AttributedActivityRecord,
  fallbackIndex: Map<string, FallbackAttributionCandidate>,
) {
  if (input.explicitMarketerId) {
    return input.explicitMarketerId;
  }

  if (!input.fallbackUserId || !input.fallbackPropertyId) {
    return null;
  }

  return (
    fallbackIndex.get(buildFallbackAttributionKey(input.fallbackUserId, input.fallbackPropertyId))?.marketerId ??
    null
  );
}

export function buildMarketerPerformanceSummary(metrics: MarketerPerformanceMetrics) {
  const summaryParts = [
    metrics.completedDeals > 0 ? `${metrics.completedDeals} closed ${metrics.completedDeals === 1 ? "deal" : "deals"}` : null,
    metrics.successfulPayments > 0
      ? `${metrics.successfulPayments} successful ${metrics.successfulPayments === 1 ? "payment" : "payments"}`
      : null,
    metrics.reservations > 0 ? `${metrics.reservations} linked ${metrics.reservations === 1 ? "reservation" : "reservations"}` : null,
    metrics.inspectionsHandled > 0
      ? `${metrics.inspectionsHandled} ${metrics.inspectionsHandled === 1 ? "inspection" : "inspections"} handled`
      : null,
    metrics.qualifiedInquiries > 0
      ? `${metrics.qualifiedInquiries} qualified ${metrics.qualifiedInquiries === 1 ? "inquiry" : "inquiries"}`
      : null,
    metrics.wishlistAdds > 0 ? `${metrics.wishlistAdds} wishlist ${metrics.wishlistAdds === 1 ? "save" : "saves"}` : null,
  ].filter(Boolean) as string[];

  return summaryParts.slice(0, 3).join(" • ") || "Performance score will appear as real client activity builds.";
}

export function buildMarketerSnapshotDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function buildMarketerSnapshotRecords(
  companyId: string,
  entries: MarketerPerformanceEntry[],
  now = new Date(),
) {
  const snapshotDate = buildMarketerSnapshotDate(now);

  return entries.map((entry) => ({
    companyId,
    teamMemberId: entry.id,
    score: entry.monthlyScore,
    rank: entry.rank,
    starRating: new Prisma.Decimal(entry.starRating.toFixed(1)),
    snapshotDate,
    wishlistAdds: entry.metrics.wishlistAdds,
    qualifiedInquiries: entry.metrics.qualifiedInquiries,
    inspectionsHandled: entry.metrics.inspectionsHandled,
    reservations: entry.metrics.reservations,
    successfulPayments: entry.metrics.successfulPayments,
    completedDeals: entry.metrics.completedDeals,
  }));
}

export function buildMarketerPerformanceTrend(
  current: Pick<MarketerPerformanceEntry, "monthlyScore" | "rank">,
  previous?: {
    score: number;
    rank: number;
    snapshotDate: Date;
  } | null,
): MarketerPerformanceTrend | null {
  if (!previous) {
    return null;
  }

  const scoreDelta = current.monthlyScore - previous.score;
  const rankDelta = previous.rank - current.rank;
  const direction =
    scoreDelta > 0 || rankDelta > 0 ? "up" : scoreDelta < 0 || rankDelta < 0 ? "down" : "flat";

  return {
    direction,
    scoreDelta,
    rankDelta,
    previousSnapshotDate: previous.snapshotDate.toISOString(),
  };
}

export function sortMarketerPerformanceEntries(
  entries: AdminMarketerPerformanceRow[],
  sortBy: "score" | "deals" | "payments" | "inspections" | "reservations" | "rating" = "score",
) {
  const sorted = [...entries];

  sorted.sort((left, right) => {
    const compare =
      sortBy === "deals"
        ? right.metrics.completedDeals - left.metrics.completedDeals
        : sortBy === "payments"
          ? right.metrics.successfulPayments - left.metrics.successfulPayments
          : sortBy === "inspections"
            ? right.metrics.inspectionsHandled - left.metrics.inspectionsHandled
            : sortBy === "reservations"
              ? right.metrics.reservations - left.metrics.reservations
              : sortBy === "rating"
                ? right.starRating - left.starRating
                : right.monthlyScore - left.monthlyScore;

    return compare || left.fullName.localeCompare(right.fullName);
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function createTenantContextForCompany(input: { companyId: string; companySlug: string | null }): TenantContext {
  return {
    userId: null,
    companyId: input.companyId,
    companySlug: input.companySlug,
    branchId: null,
    roles: [],
    isSuperAdmin: false,
    host: null,
    resolutionSource: "none",
  };
}

function getMarketerRankingSnapshotDelegate() {
  return (prisma as typeof prisma & { marketerRankingSnapshot?: MarketerRankingSnapshotDelegate })
    .marketerRankingSnapshot;
}

async function getTenantMarketerPerformanceEntries(
  context: TenantContext,
  now: Date,
  options?: {
    includeUnpublished?: boolean;
    includeInactive?: boolean;
  },
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [] as MarketerPerformanceEntry[];
  }

  const monthStart = startOfMonth(now);
  const members = (await findManyForTenant(
    prisma.teamMember as ScopedFindManyDelegate,
    context,
    {
      where: {
        ...(options?.includeInactive ? {} : { isActive: true }),
        ...(options?.includeUnpublished ? {} : { isPublished: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        fullName: true,
        title: true,
        avatarUrl: true,
        isActive: true,
        isPublished: true,
      },
    } as Parameters<typeof prisma.teamMember.findMany>[0],
  )) as TeamMemberPerformanceRow[];

  if (members.length === 0) {
    return [];
  }

  const memberIds = members.map((member) => member.id);

  const [wishlistAdds, reservations, completedDeals, successfulPayments, inquiries, inspections] =
    await Promise.all([
      prisma.savedProperty.findMany({
        where: {
          companyId: context.companyId,
          status: "ACTIVE",
          createdAt: {
            gte: monthStart,
          },
          selectedMarketerId: {
            in: memberIds,
          },
        },
        select: {
          selectedMarketerId: true,
        },
      }),
      prisma.reservation.findMany({
        where: {
          companyId: context.companyId,
          createdAt: {
            gte: monthStart,
          },
        },
        select: {
          marketerId: true,
          userId: true,
          propertyId: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          companyId: context.companyId,
          paymentStatus: "COMPLETED",
          lastPaymentAt: {
            gte: monthStart,
          },
        },
        select: {
          marketerId: true,
          userId: true,
          propertyId: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          companyId: context.companyId,
          status: "SUCCESS",
          paidAt: {
            gte: monthStart,
          },
        },
        select: {
          marketerId: true,
          transaction: {
            select: {
              marketerId: true,
              userId: true,
              propertyId: true,
              reservation: {
                select: {
                  marketerId: true,
                },
              },
            },
          },
        },
      }),
      prisma.inquiry.findMany({
        where: {
          companyId: context.companyId,
          assignedStaffId: {
            not: null,
          },
          propertyId: {
            not: null,
          },
          userId: {
            not: null,
          },
          createdAt: {
            gte: monthStart,
          },
          status: {
            in: ["QUALIFIED", "CONVERTED"],
          },
        },
        select: {
          userId: true,
          propertyId: true,
          createdAt: true,
          assignedStaff: {
            select: {
              teamMemberId: true,
            },
          },
        },
      }),
      prisma.inspectionBooking.findMany({
        where: {
          companyId: context.companyId,
          assignedStaffId: {
            not: null,
          },
          userId: {
            not: null,
          },
          createdAt: {
            gte: monthStart,
          },
          status: {
            in: ["CONFIRMED", "RESCHEDULED", "COMPLETED", "NO_SHOW"],
          },
        },
        select: {
          userId: true,
          propertyId: true,
          createdAt: true,
          assignedStaff: {
            select: {
              teamMemberId: true,
            },
          },
        },
      }),
    ]);

  // Buyer-selected marketer attribution remains the primary source.
  // Inquiry and inspection assignment only fills gaps where no explicit marketer was chosen.
  const fallbackIndex = buildFallbackAttributionIndex([
    ...inquiries.flatMap((inquiry) =>
      inquiry.assignedStaff?.teamMemberId && inquiry.userId && inquiry.propertyId
        ? [
            {
              marketerId: inquiry.assignedStaff.teamMemberId,
              userId: inquiry.userId,
              propertyId: inquiry.propertyId,
              happenedAt: inquiry.createdAt,
              source: "inquiry" as const,
            },
          ]
        : [],
    ),
    ...inspections.flatMap((inspection) =>
      inspection.assignedStaff?.teamMemberId && inspection.userId && inspection.propertyId
        ? [
            {
              marketerId: inspection.assignedStaff.teamMemberId,
              userId: inspection.userId,
              propertyId: inspection.propertyId,
              happenedAt: inspection.createdAt,
              source: "inspection" as const,
            },
          ]
        : [],
    ),
  ]);

  const metricsByMember = new Map<string, MarketerPerformanceMetrics>();

  for (const member of members) {
    metricsByMember.set(member.id, {
      wishlistAdds: 0,
      qualifiedInquiries: 0,
      inspectionsHandled: 0,
      reservations: 0,
      successfulPayments: 0,
      completedDeals: 0,
    });
  }

  const increment = (memberId: string | null, metric: keyof MarketerPerformanceMetrics) => {
    if (!memberId || !metricsByMember.has(memberId)) {
      return;
    }

    const current = metricsByMember.get(memberId);
    if (!current) {
      return;
    }

    current[metric] += 1;
  };

  for (const item of wishlistAdds) {
    increment(item.selectedMarketerId, "wishlistAdds");
  }

  for (const inquiry of inquiries) {
    increment(inquiry.assignedStaff?.teamMemberId ?? null, "qualifiedInquiries");
  }

  for (const inspection of inspections) {
    increment(inspection.assignedStaff?.teamMemberId ?? null, "inspectionsHandled");
  }

  for (const reservation of reservations) {
    increment(
      resolveAttributedMarketerId(
        {
          explicitMarketerId: reservation.marketerId,
          fallbackUserId: reservation.userId,
          fallbackPropertyId: reservation.propertyId,
        },
        fallbackIndex,
      ),
      "reservations",
    );
  }

  for (const transaction of completedDeals) {
    increment(
      resolveAttributedMarketerId(
        {
          explicitMarketerId: transaction.marketerId,
          fallbackUserId: transaction.userId,
          fallbackPropertyId: transaction.propertyId,
        },
        fallbackIndex,
      ),
      "completedDeals",
    );
  }

  for (const payment of successfulPayments) {
    increment(
      resolveAttributedMarketerId(
        {
          explicitMarketerId:
            payment.marketerId ?? payment.transaction?.marketerId ?? payment.transaction?.reservation?.marketerId ?? null,
          fallbackUserId: payment.transaction?.userId ?? null,
          fallbackPropertyId: payment.transaction?.propertyId ?? null,
        },
        fallbackIndex,
      ),
      "successfulPayments",
    );
  }

  return members
    .map((member) => {
      const metrics = metricsByMember.get(member.id)!;
      const monthlyScore = buildMarketerPerformanceScore(metrics);

      return {
        id: member.id,
        slug: member.slug,
        fullName: member.fullName,
        title: member.title,
        avatarUrl: member.avatarUrl,
        isActive: member.isActive,
        isPublished: member.isPublished,
        monthlyScore,
        starRating: buildMarketerStarRating(monthlyScore),
        rank: 0,
        summary: buildMarketerPerformanceSummary(metrics),
        metrics,
      };
    })
    .sort(
      (a, b) =>
        b.monthlyScore - a.monthlyScore ||
        b.metrics.completedDeals - a.metrics.completedDeals ||
        a.fullName.localeCompare(b.fullName),
    )
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export async function getTenantMarketerLeaderboard(
  context: TenantContext,
  now = new Date(),
  limit = 3,
): Promise<MarketerPerformanceEntry[]> {
  const entries = await getTenantMarketerPerformanceEntries(context, now, {
    includeInactive: false,
    includeUnpublished: false,
  });

  return entries.filter((entry) => entry.monthlyScore > 0).slice(0, limit);
}

export async function getTenantMarketerPerformanceSummary(
  context: TenantContext,
  marketerId: string,
  now = new Date(),
) {
  const entries = await getTenantMarketerPerformanceEntries(context, now, {
    includeInactive: false,
    includeUnpublished: false,
  });

  return entries.find((entry) => entry.id === marketerId) ?? null;
}

export async function getAdminMarketerPerformanceDashboard(
  context: TenantContext,
  input?: {
    now?: Date;
    search?: string;
    sortBy?: "score" | "deals" | "payments" | "inspections" | "reservations" | "rating";
  },
) {
  const now = input?.now ?? new Date();
  const entries = await getTenantMarketerPerformanceEntries(context, now, {
    includeInactive: true,
    includeUnpublished: true,
  });

  const normalizedSearch = input?.search?.trim().toLowerCase() ?? "";
  const filtered = normalizedSearch
    ? entries.filter(
        (entry) =>
          entry.fullName.toLowerCase().includes(normalizedSearch) ||
          entry.title.toLowerCase().includes(normalizedSearch),
      )
    : entries;

  const snapshotDelegate = getMarketerRankingSnapshotDelegate();
  const snapshots = context.companyId && snapshotDelegate
    ? await snapshotDelegate.findMany({
        where: {
          companyId: context.companyId,
          teamMemberId: {
            in: filtered.map((entry) => entry.id),
          },
          snapshotDate: {
            gte: subDays(buildMarketerSnapshotDate(now), 14),
            lt: buildMarketerSnapshotDate(now),
          },
        },
        orderBy: [{ snapshotDate: "desc" }, { rank: "asc" }],
        select: {
          teamMemberId: true,
          score: true,
          rank: true,
          snapshotDate: true,
        },
      })
    : [];

  const previousByMember = new Map<string, { score: number; rank: number; snapshotDate: Date }>();
  for (const snapshot of snapshots) {
    if (!previousByMember.has(snapshot.teamMemberId)) {
      previousByMember.set(snapshot.teamMemberId, snapshot);
    }
  }

  const rows = sortMarketerPerformanceEntries(
    filtered.map((entry) => ({
      ...entry,
      trend: buildMarketerPerformanceTrend(entry, previousByMember.get(entry.id) ?? null),
    })),
    input?.sortBy ?? "score",
  );

  return {
    topPerformer: rows.find((row) => row.monthlyScore > 0) ?? null,
    rows,
    latestSnapshotDate:
      snapshots.reduce<Date | null>(
        (latest, snapshot) =>
          !latest || snapshot.snapshotDate > latest ? snapshot.snapshotDate : latest,
        null,
      )?.toISOString() ?? null,
  };
}

export async function syncMarketerRankingSnapshots(input?: {
  companyId?: string | null;
  now?: Date;
}) {
  const now = input?.now ?? new Date();

  if (!featureFlags.hasDatabase) {
    return {
      companies: 0,
      snapshots: 0,
      snapshotDate: buildMarketerSnapshotDate(now).toISOString(),
    };
  }

  const companies = await prisma.company.findMany({
    where: input?.companyId ? { id: input.companyId } : undefined,
    select: {
      id: true,
      slug: true,
    },
  });

  let snapshots = 0;
  const snapshotDelegate = getMarketerRankingSnapshotDelegate();

  if (!snapshotDelegate) {
    return {
      companies: companies.length,
      snapshots: 0,
      snapshotDate: buildMarketerSnapshotDate(now).toISOString(),
    };
  }

  for (const company of companies) {
    const context = createTenantContextForCompany({
      companyId: company.id,
      companySlug: company.slug,
    });
    const entries = await getTenantMarketerPerformanceEntries(context, now, {
      includeInactive: true,
      includeUnpublished: true,
    });

    for (const record of buildMarketerSnapshotRecords(company.id, entries, now)) {
      await snapshotDelegate.upsert({
        where: {
          companyId_teamMemberId_snapshotDate: {
            companyId: record.companyId,
            teamMemberId: record.teamMemberId,
            snapshotDate: record.snapshotDate,
          },
        },
        update: {
          score: record.score,
          rank: record.rank,
          starRating: record.starRating,
          wishlistAdds: record.wishlistAdds,
          qualifiedInquiries: record.qualifiedInquiries,
          inspectionsHandled: record.inspectionsHandled,
          reservations: record.reservations,
          successfulPayments: record.successfulPayments,
          completedDeals: record.completedDeals,
        },
        create: record,
      });
      snapshots += 1;
    }
  }

  return {
    companies: companies.length,
    snapshots,
    snapshotDate: buildMarketerSnapshotDate(now).toISOString(),
  };
}
