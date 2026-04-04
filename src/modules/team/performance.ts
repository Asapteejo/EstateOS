import { startOfMonth } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findManyForTenant } from "@/lib/tenancy/db";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

type TeamMemberLeaderboardRow = {
  id: string;
  slug: string;
  fullName: string;
  title: string;
  avatarUrl: string | null;
  email: string | null;
  staffCode: string | null;
};

type StaffProfileMatchRow = {
  id: string;
  staffCode: string | null;
  user: {
    email: string;
  };
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
  monthlyScore: number;
  starRating: number;
  rank: number;
  summary: string;
  metrics: MarketerPerformanceMetrics;
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

function normalizeLooseString(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function buildStaffProfileMarketerMap(
  members: Array<Pick<TeamMemberLeaderboardRow, "id" | "email" | "staffCode">>,
  staffProfiles: StaffProfileMatchRow[],
) {
  const byEmail = new Map<string, string>();
  const byStaffCode = new Map<string, string>();
  const duplicateEmails = new Set<string>();
  const duplicateStaffCodes = new Set<string>();

  for (const member of members) {
    const emailKey = normalizeLooseString(member.email);
    if (emailKey) {
      if (byEmail.has(emailKey)) {
        duplicateEmails.add(emailKey);
      } else {
        byEmail.set(emailKey, member.id);
      }
    }

    const staffCodeKey = normalizeLooseString(member.staffCode);
    if (staffCodeKey) {
      if (byStaffCode.has(staffCodeKey)) {
        duplicateStaffCodes.add(staffCodeKey);
      } else {
        byStaffCode.set(staffCodeKey, member.id);
      }
    }
  }

  const matches = new Map<string, string>();

  for (const profile of staffProfiles) {
    const emailKey = normalizeLooseString(profile.user.email);
    const staffCodeKey = normalizeLooseString(profile.staffCode);
    const byProfileEmail = duplicateEmails.has(emailKey) ? null : byEmail.get(emailKey);
    const byProfileStaffCode = duplicateStaffCodes.has(staffCodeKey) ? null : byStaffCode.get(staffCodeKey);

    if (byProfileEmail) {
      matches.set(profile.id, byProfileEmail);
      continue;
    }

    if (byProfileStaffCode) {
      matches.set(profile.id, byProfileStaffCode);
    }
  }

  return matches;
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

async function getTenantMarketerPerformanceEntries(
  context: TenantContext,
  now: Date,
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
        isActive: true,
        isPublished: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        fullName: true,
        title: true,
        avatarUrl: true,
        email: true,
        staffCode: true,
      },
    } as Parameters<typeof prisma.teamMember.findMany>[0],
  )) as TeamMemberLeaderboardRow[];

  if (members.length === 0) {
    return [];
  }

  const memberIds = new Set(members.map((member) => member.id));

  const [staffProfiles, wishlistAdds, reservations, completedDeals, successfulPayments, inquiries, inspections] =
    await Promise.all([
      prisma.staffProfile.findMany({
        where: {
          user: {
            companyId: context.companyId,
          },
        },
        select: {
          id: true,
          staffCode: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      }),
      prisma.savedProperty.findMany({
        where: {
          companyId: context.companyId,
          status: "ACTIVE",
          createdAt: {
            gte: monthStart,
          },
          selectedMarketerId: {
            in: [...memberIds],
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
          assignedStaffId: true,
          userId: true,
          propertyId: true,
          createdAt: true,
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
          assignedStaffId: true,
          userId: true,
          propertyId: true,
          createdAt: true,
        },
      }),
    ]);

  const staffProfileMap = buildStaffProfileMarketerMap(members, staffProfiles);
  // Buyer-selected marketer attribution remains the primary source.
  // Assigned inquiry/inspection staff only fills gaps where the buyer never selected a marketer.
  const fallbackIndex = buildFallbackAttributionIndex([
    ...inquiries.flatMap((inquiry) => {
      const marketerId = inquiry.assignedStaffId ? staffProfileMap.get(inquiry.assignedStaffId) : null;
      return marketerId && inquiry.userId && inquiry.propertyId
        ? [
            {
              marketerId,
              userId: inquiry.userId,
              propertyId: inquiry.propertyId,
              happenedAt: inquiry.createdAt,
              source: "inquiry" as const,
            },
          ]
        : [];
    }),
    ...inspections.flatMap((inspection) => {
      const marketerId = inspection.assignedStaffId ? staffProfileMap.get(inspection.assignedStaffId) : null;
      return marketerId && inspection.userId && inspection.propertyId
        ? [
            {
              marketerId,
              userId: inspection.userId,
              propertyId: inspection.propertyId,
              happenedAt: inspection.createdAt,
              source: "inspection" as const,
            },
          ]
        : [];
    }),
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
    const memberId = inquiry.assignedStaffId ? staffProfileMap.get(inquiry.assignedStaffId) ?? null : null;
    increment(memberId, "qualifiedInquiries");
  }

  for (const inspection of inspections) {
    const memberId = inspection.assignedStaffId ? staffProfileMap.get(inspection.assignedStaffId) ?? null : null;
    increment(memberId, "inspectionsHandled");
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
        monthlyScore,
        starRating: buildMarketerStarRating(monthlyScore),
        rank: 0,
        summary: buildMarketerPerformanceSummary(metrics),
        metrics,
      };
    })
    .sort((a, b) => b.monthlyScore - a.monthlyScore || b.metrics.completedDeals - a.metrics.completedDeals || a.fullName.localeCompare(b.fullName))
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
  const entries = await getTenantMarketerPerformanceEntries(context, now);

  return entries.filter((entry) => entry.monthlyScore > 0).slice(0, limit);
}

export async function getTenantMarketerPerformanceSummary(
  context: TenantContext,
  marketerId: string,
  now = new Date(),
) {
  const entries = await getTenantMarketerPerformanceEntries(context, now);

  return entries.find((entry) => entry.id === marketerId) ?? null;
}
