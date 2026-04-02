import { startOfMonth } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findManyForTenant } from "@/lib/tenancy/db";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export type MarketerPerformanceEntry = {
  id: string;
  slug: string;
  fullName: string;
  title: string;
  avatarUrl: string | null;
  monthlyScore: number;
  starRating: number;
  metrics: {
    wishlistAdds: number;
    reservations: number;
    successfulPayments: number;
  };
};

export function buildMarketerPerformanceScore(input: {
  wishlistAdds: number;
  reservations: number;
  successfulPayments: number;
}) {
  return input.wishlistAdds + input.reservations * 3 + input.successfulPayments * 5;
}

export function buildMarketerStarRating(score: number) {
  return Math.max(3, Math.min(5, Number((3 + score / 10).toFixed(1))));
}

export async function getTenantMarketerLeaderboard(
  context: TenantContext,
  now = new Date(),
  limit = 3,
): Promise<MarketerPerformanceEntry[]> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
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
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        slug: true,
        fullName: true,
        title: true,
        avatarUrl: true,
      },
    } as Parameters<typeof prisma.teamMember.findMany>[0],
  )) as Array<{
    id: string;
    slug: string;
    fullName: string;
    title: string;
    avatarUrl: string | null;
  }>;

  const scored = await Promise.all(
    members.map(async (member) => {
      const [wishlistAdds, reservations, successfulPayments] = await Promise.all([
        prisma.savedProperty.count({
          where: {
            companyId: context.companyId!,
            selectedMarketerId: member.id,
            status: "ACTIVE",
            createdAt: {
              gte: monthStart,
            },
          },
        }),
        prisma.reservation.count({
          where: {
            companyId: context.companyId!,
            marketerId: member.id,
            createdAt: {
              gte: monthStart,
            },
          },
        }),
        prisma.payment.count({
          where: {
            companyId: context.companyId!,
            marketerId: member.id,
            status: "SUCCESS",
            paidAt: {
              gte: monthStart,
            },
          },
        }),
      ]);

      const monthlyScore = buildMarketerPerformanceScore({
        wishlistAdds,
        reservations,
        successfulPayments,
      });

      return {
        ...member,
        monthlyScore,
        starRating: buildMarketerStarRating(monthlyScore),
        metrics: {
          wishlistAdds,
          reservations,
          successfulPayments,
        },
      };
    }),
  );

  return scored
    .sort((a, b) => b.monthlyScore - a.monthlyScore || a.fullName.localeCompare(b.fullName))
    .slice(0, limit);
}
