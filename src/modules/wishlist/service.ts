import { Prisma } from "@prisma/client";
import { addDays, differenceInCalendarDays } from "date-fns";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { createInAppNotification, getTenantOperatorRecipients } from "@/lib/notifications/service";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant, rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type {
  SavedPropertyMutationInput,
  WishlistFollowUpMutationInput,
} from "@/lib/validations/saved-properties";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ensureVisibleTeamMember } from "@/modules/team/queries";
import { getCompanyOperationalDefaults } from "@/modules/settings/service";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export const DEFAULT_WISHLIST_DURATION_DAYS = 14;
export const WISHLIST_REMINDER_THRESHOLD_DAYS = 3;

export type WishlistLifecycleState = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "REMOVED";

export type BuyerWishlistItem = {
  id: string;
  propertyId: string;
  propertySlug: string;
  propertyTitle: string;
  propertyImage: string;
  propertyPrice: string;
  paymentPlanSummary: string;
  savedAt: string;
  expiresAt: string | null;
  status: WishlistLifecycleState;
  timeLabel: string;
  selectedMarketerName: string | null;
  followUpStatus: string;
};

export type WishlistReminderCandidate = {
  id: string;
  companyId: string;
  userId: string;
  userFirstName: string | null;
  userEmail: string | null;
  propertyTitle: string;
  propertySlug: string;
  priceFrom: number;
  expiresAt: Date;
};

export function buildWishlistExpiry(
  savedAt: Date,
  durationDays = DEFAULT_WISHLIST_DURATION_DAYS,
) {
  return addDays(savedAt, durationDays);
}

export function getWishlistLifecycleState(
  input: {
    status: "ACTIVE" | "EXPIRED" | "REMOVED";
    expiresAt?: Date | null;
    removedAt?: Date | null;
  },
  now = new Date(),
): WishlistLifecycleState {
  if (input.status === "REMOVED" || input.removedAt) {
    return "REMOVED";
  }

  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) {
    return "EXPIRED";
  }

  if (input.expiresAt && differenceInCalendarDays(input.expiresAt, now) <= WISHLIST_REMINDER_THRESHOLD_DAYS) {
    return "EXPIRING_SOON";
  }

  return input.status === "EXPIRED" ? "EXPIRED" : "ACTIVE";
}

export function buildWishlistTimeLabel(
  input: {
    status: WishlistLifecycleState;
    expiresAt?: Date | null;
    createdAt: Date;
  },
  now = new Date(),
) {
  if (input.status === "REMOVED") {
    return "Removed from wishlist";
  }

  if (!input.expiresAt) {
    return `Saved ${formatDate(input.createdAt)}`;
  }

  if (input.status === "EXPIRED") {
    return `Expired ${formatDate(input.expiresAt)}`;
  }

  const daysLeft = differenceInCalendarDays(input.expiresAt, now);
  return daysLeft <= 0 ? "Expires today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

export function isWishlistReminderEligible(
  input: {
    status: "ACTIVE" | "EXPIRED" | "REMOVED";
    expiresAt?: Date | null;
    reminderSentAt?: Date | null;
    reminderEnabled?: boolean;
  },
  now = new Date(),
) {
  if (!input.reminderEnabled || input.status !== "ACTIVE" || input.reminderSentAt || !input.expiresAt) {
    return false;
  }

  const daysLeft = differenceInCalendarDays(input.expiresAt, now);
  return daysLeft >= 0 && daysLeft <= WISHLIST_REMINDER_THRESHOLD_DAYS;
}

export function buildWishlistWhatsAppHref(input: {
  phone?: string | null;
  clientName: string;
  propertyTitle: string;
}) {
  if (!input.phone) {
    return null;
  }

  const normalized = input.phone.replace(/[^\d+]/g, "");
  if (!normalized) {
    return null;
  }

  const number = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  const message = encodeURIComponent(
    `Hello ${input.clientName}, just checking in on your saved interest in ${input.propertyTitle}.`,
  );

  return `https://wa.me/${number}?text=${message}`;
}

export function buildSavedPropertyUniqueInput(input: {
  companyId: string;
  userId: string;
  propertyId: string;
}) {
  return {
    companyId_userId_propertyId: {
      companyId: input.companyId,
      userId: input.userId,
      propertyId: input.propertyId,
    },
  };
}

async function ensureBuyerWishlistProperty(
  context: TenantContext,
  propertyId: string,
) {
  return (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: propertyId,
        status: {
          in: ["AVAILABLE", "RESERVED", "SOLD"],
        },
      },
      select: {
        id: true,
        title: true,
        wishlistDurationDays: true,
        wishlistReminderEnabled: true,
      },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as {
    id: string;
    title: string;
    wishlistDurationDays: number | null;
    wishlistReminderEnabled: boolean;
  } | null;
}

async function createWishlistAdminSignals(input: {
  companyId: string;
  wishlistId: string;
  propertyId: string;
  propertyTitle: string;
  userId: string;
  buyerName: string;
}) {
  const operators = await getTenantOperatorRecipients(input.companyId);

  await Promise.all(
    operators.map((recipient) =>
      createInAppNotification({
        companyId: input.companyId,
        userId: recipient.id,
        type: "WISHLIST_ADDED",
        title: "Property added to wishlist",
        body: `${input.buyerName} added ${input.propertyTitle} to wishlist.`,
        metadata: {
          wishlistId: input.wishlistId,
          propertyId: input.propertyId,
          clientId: input.userId,
          href: `/admin/clients/${input.userId}`,
        } as Prisma.InputJsonValue,
      }),
    ),
  );
}

export async function toggleWishlistPropertyForBuyer(
  context: TenantContext,
  input: SavedPropertyMutationInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(input);

  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      status: "saved" as const,
      propertyId: input.propertyId,
      expiresAt: buildWishlistExpiry(new Date()).toISOString(),
    };
  }

  const property = await ensureBuyerWishlistProperty(context, input.propertyId);
  if (!property) {
    throw new Error("Property not found.");
  }

  let selectedMarketerId: string | null = null;
  if (input.marketerId) {
    const marketer = await ensureVisibleTeamMember(context, input.marketerId);
    if (!marketer) {
      throw new Error("Selected marketer is not available.");
    }
    selectedMarketerId = marketer.id;
  }

  const existing = await prisma.savedProperty.findUnique({
    where: buildSavedPropertyUniqueInput({
      companyId: context.companyId,
      userId: context.userId,
      propertyId: property.id,
    }),
    select: {
      id: true,
      status: true,
    },
  });

  if (existing?.status === "ACTIVE") {
    await prisma.savedProperty.update({
      where: { id: existing.id },
      data: {
        status: "REMOVED",
        removedAt: new Date(),
        followUpStatus: "CLOSED",
      },
    });

    return {
      status: "removed" as const,
      propertyId: property.id,
      expiresAt: null,
    };
  }

  const now = new Date();
  const expiresAt = buildWishlistExpiry(
    now,
    property.wishlistDurationDays ??
      (await getCompanyOperationalDefaults(context.companyId)).defaultWishlistDurationDays ??
      DEFAULT_WISHLIST_DURATION_DAYS,
  );

  const saved = existing
    ? await prisma.savedProperty.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          createdAt: now,
          expiresAt,
          reminderSentAt: null,
          removedAt: null,
          selectedMarketerId,
          followUpStatus: "NONE",
        },
        select: {
          id: true,
        },
      })
    : await prisma.savedProperty.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          propertyId: property.id,
          status: "ACTIVE",
          expiresAt,
          selectedMarketerId,
        },
        select: {
          id: true,
        },
      });

  const buyer = await prisma.user.findUnique({
    where: { id: context.userId },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  const buyerName =
    `${buyer?.firstName ?? ""} ${buyer?.lastName ?? ""}`.trim() || "A client";

  await createWishlistAdminSignals({
    companyId: context.companyId,
    wishlistId: saved.id,
    propertyId: property.id,
    propertyTitle: property.title,
    userId: context.userId,
    buyerName,
  });

  await prisma.activityEvent.create({
    data: {
      companyId: context.companyId,
      userId: context.userId,
      eventName: "wishlist.added",
      summary: `${buyerName} added ${property.title} to wishlist.`,
      payload: {
        propertyId: property.id,
        wishlistId: saved.id,
        selectedMarketerId,
      } as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "CREATE",
    entityType: "SavedProperty",
    entityId: saved.id,
    summary: `Saved ${property.title} to wishlist`,
    payload: {
      propertyId: property.id,
      selectedMarketerId,
      expiresAt,
    } as Prisma.InputJsonValue,
  });

  return {
    status: "saved" as const,
    propertyId: property.id,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getBuyerWishlistItems(context: TenantContext): Promise<BuyerWishlistItem[]> {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return [];
  }

  const rows = (await findManyForTenant(
    prisma.savedProperty as ScopedFindManyDelegate,
    context,
    {
      where: {
        userId: context.userId,
        status: {
          in: ["ACTIVE", "EXPIRED"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        followUpStatus: true,
        selectedMarketer: {
          select: {
            fullName: true,
          },
        },
        property: {
          select: {
            id: true,
            slug: true,
            title: true,
            priceFrom: true,
            currency: true,
            media: {
              where: {
                visibility: "PUBLIC",
              },
              orderBy: {
                sortOrder: "asc",
              },
              take: 1,
              select: {
                url: true,
              },
            },
            paymentPlans: {
              where: {
                isActive: true,
              },
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
              select: {
                title: true,
                durationMonths: true,
                depositPercent: true,
              },
            },
          },
        },
      },
    } as Parameters<typeof prisma.savedProperty.findMany>[0],
  )) as Array<{
    id: string;
    status: "ACTIVE" | "EXPIRED" | "REMOVED";
    createdAt: Date;
    expiresAt: Date | null;
    followUpStatus: string;
    selectedMarketer: { fullName: string } | null;
    property: {
      id: string;
      slug: string;
      title: string;
      priceFrom: { toNumber?: () => number } | number;
      currency: string;
      media: Array<{ url: string }>;
      paymentPlans: Array<{ title: string; durationMonths: number; depositPercent: { toNumber?: () => number } | number | null }>;
    };
  }>;

  return rows.map((row) => {
    const lifecycleState = getWishlistLifecycleState(row);
    const price =
      typeof row.property.priceFrom === "number"
        ? row.property.priceFrom
        : row.property.priceFrom.toNumber?.() ?? Number(row.property.priceFrom);
    const primaryPlan = row.property.paymentPlans[0];

    return {
      id: row.id,
      propertyId: row.property.id,
      propertySlug: row.property.slug,
      propertyTitle: row.property.title,
      propertyImage:
        row.property.media[0]?.url ??
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      propertyPrice: formatCurrency(price, row.property.currency),
      paymentPlanSummary: primaryPlan
        ? `${primaryPlan.title} · ${primaryPlan.durationMonths} months`
        : "One-time payment available",
      savedAt: formatDate(row.createdAt),
      expiresAt: row.expiresAt ? formatDate(row.expiresAt) : null,
      status: lifecycleState,
      timeLabel: buildWishlistTimeLabel({
        status: lifecycleState,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      }),
      selectedMarketerName: row.selectedMarketer?.fullName ?? null,
      followUpStatus: row.followUpStatus,
    };
  });
}

export async function updateWishlistFollowUpForAdmin(
  context: TenantContext,
  wishlistId: string,
  input: WishlistFollowUpMutationInput,
) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return { id: wishlistId, ...input };
  }

  const existing = (await findFirstForTenant(
    prisma.savedProperty as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: wishlistId,
      },
      select: {
        id: true,
        userId: true,
      },
    } as Parameters<typeof prisma.savedProperty.findFirst>[0],
  )) as { id: string; userId: string } | null;

  if (!existing) {
    throw new Error("Wishlist item not found.");
  }

  if (input.assignedStaffId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: input.assignedStaffId,
        companyId: context.companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!assignee) {
      throw new Error("Assigned staff member not found for this tenant.");
    }
  }

  const updated = await prisma.savedProperty.update({
    where: {
      id: wishlistId,
    },
    data: {
      assignedStaffId: input.assignedStaffId ?? null,
      followUpStatus: input.followUpStatus,
      followUpNote: input.followUpNote ?? null,
    },
    select: {
      id: true,
      userId: true,
      assignedStaffId: true,
      followUpStatus: true,
      followUpNote: true,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "SavedProperty",
    entityId: wishlistId,
    summary: `Updated wishlist follow-up state for ${wishlistId}`,
    payload: {
      assignedStaffId: updated.assignedStaffId,
      followUpStatus: updated.followUpStatus,
    } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function getWishlistReminderCandidates(now = new Date()) {
  if (!featureFlags.hasDatabase) {
    return [] as WishlistReminderCandidate[];
  }

  const rows = await prisma.savedProperty.findMany({
    where: {
      status: "ACTIVE",
      reminderSentAt: null,
      expiresAt: {
        gte: now,
        lte: addDays(now, WISHLIST_REMINDER_THRESHOLD_DAYS),
      },
      property: {
        wishlistReminderEnabled: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      expiresAt: true,
      user: {
        select: {
          firstName: true,
          email: true,
        },
      },
      property: {
        select: {
          title: true,
          slug: true,
          priceFrom: true,
        },
      },
    },
  });

  return rows
    .filter((row) => row.expiresAt && row.user.email)
    .map((row) => ({
      id: row.id,
      companyId: row.companyId,
      userId: row.userId,
      userFirstName: row.user.firstName,
      userEmail: row.user.email,
      propertyTitle: row.property.title,
      propertySlug: row.property.slug,
      priceFrom:
        typeof row.property.priceFrom === "number"
          ? row.property.priceFrom
          : row.property.priceFrom.toNumber?.() ?? Number(row.property.priceFrom),
      expiresAt: row.expiresAt!,
    }));
}

export async function sendWishlistReminder(savedPropertyId: string) {
  if (!featureFlags.hasDatabase) {
    return { delivered: false, reason: "database-disabled" as const };
  }

  const wishlist = await prisma.savedProperty.findUnique({
    where: { id: savedPropertyId },
    select: {
      id: true,
      companyId: true,
      userId: true,
      status: true,
      expiresAt: true,
      reminderSentAt: true,
      property: {
        select: {
          title: true,
          slug: true,
          wishlistReminderEnabled: true,
        },
      },
      user: {
        select: {
          firstName: true,
          email: true,
        },
      },
    },
  });

  if (
    !wishlist ||
    !isWishlistReminderEligible({
      status: wishlist.status,
      expiresAt: wishlist.expiresAt,
      reminderSentAt: wishlist.reminderSentAt,
      reminderEnabled: wishlist.property.wishlistReminderEnabled,
    }) ||
    !wishlist.user.email
  ) {
    return { delivered: false, reason: "not-eligible" as const };
  }

  await sendTransactionalEmail({
    to: wishlist.user.email,
    subject: `Your wishlist interest in ${wishlist.property.title} is nearing expiry`,
    html: `<p>Hi ${wishlist.user.firstName ?? "there"},</p><p>Your saved interest in <strong>${wishlist.property.title}</strong> is due to expire on ${formatDate(wishlist.expiresAt!)}.</p><p>Review the property and continue your purchase journey from your EstateOS buyer portal.</p>`,
  });

  await prisma.savedProperty.update({
    where: {
      id: savedPropertyId,
    },
    data: {
      reminderSentAt: new Date(),
    },
  });

  await createInAppNotification({
    companyId: wishlist.companyId,
    userId: wishlist.userId,
    type: "WISHLIST_EXPIRING",
    title: "Wishlist item expiring soon",
    body: `${wishlist.property.title} is nearing the end of its wishlist window.`,
    metadata: {
      wishlistId: savedPropertyId,
      propertySlug: wishlist.property.slug,
    } as Prisma.InputJsonValue,
  });

  await prisma.activityEvent.create({
    data: {
      companyId: wishlist.companyId,
      userId: wishlist.userId,
      eventName: "wishlist.reminder_sent",
      summary: `Wishlist reminder sent for ${wishlist.property.title}.`,
      payload: {
        wishlistId: savedPropertyId,
      } as Prisma.InputJsonValue,
    },
  });

  return { delivered: true };
}

export async function syncExpiredWishlists(now = new Date()) {
  if (!featureFlags.hasDatabase) {
    return { updated: 0 };
  }

  const result = await prisma.savedProperty.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        lt: now,
      },
    },
    data: {
      status: "EXPIRED",
    },
  });

  return { updated: result.count };
}

export async function runWishlistReminderSweep(now = new Date()) {
  await syncExpiredWishlists(now);
  const candidates = await getWishlistReminderCandidates(now);
  const results = await Promise.all(candidates.map((candidate) => sendWishlistReminder(candidate.id)));

  return {
    scanned: candidates.length,
    delivered: results.filter((result) => result.delivered).length,
  };
}
