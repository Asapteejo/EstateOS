import type { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { createInAppNotification, getTenantOperatorRecipients, notifyManyUsers } from "@/lib/notifications/service";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant } from "@/lib/tenancy/db";
import {
  publicTestimonialsFilterSchema,
  testimonialAdminActionSchema,
  testimonialResubmissionSchema,
  testimonialSubmissionSchema,
  type PublicTestimonialsFilterInput,
} from "@/lib/validations/testimonials";
import { formatDate } from "@/lib/utils";
import { resolveBuyerDbUserForKyc } from "@/modules/kyc/buyer-user";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

type TestimonialStatusValue =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "UNPUBLISHED"
  | "DELETED";
type PublicTestimonialsFilters = Partial<PublicTestimonialsFilterInput>;

export const testimonialStatusLabels: Record<TestimonialStatusValue, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
  DELETED: "Deleted",
};

export type PublicTestimonialCard = {
  id: string;
  displayName: string;
  role: string;
  company?: string;
  quote: string;
  title?: string;
  rating: number;
  avatarUrl: string | null;
  propertyTitle: string | null;
  isVerifiedBuyer: boolean;
  publishedAt: string;
};

export type BuyerTestimonialItem = {
  id: string;
  title: string | null;
  quote: string;
  rating: number;
  status: TestimonialStatusValue;
  statusLabel: string;
  rejectionReason: string | null;
  propertyTitle: string | null;
  isVerifiedBuyer: boolean;
  submittedAt: string;
  publishedAt: string | null;
};

export type AdminTestimonialItem = BuyerTestimonialItem & {
  displayName: string;
  avatarUrl: string | null;
  source: string;
  buyerEmail: string | null;
};

export type TestimonialPropertyOption = {
  id: string;
  title: string;
};

function buildDateRange(filters: PublicTestimonialsFilters) {
  if (filters.from || filters.to) {
    return {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  if (!filters.year) {
    return undefined;
  }

  const start = new Date(Date.UTC(filters.year, (filters.month ?? 1) - 1, 1));
  const end = filters.month
    ? new Date(Date.UTC(filters.year, filters.month, 1))
    : new Date(Date.UTC(filters.year + 1, 0, 1));

  return {
    gte: start,
    lt: end,
  };
}

export function buildPublicTestimonialsWhere(filters: PublicTestimonialsFilters = {}) {
  const dateRange = buildDateRange(filters);

  return {
    status: "PUBLISHED",
    isPublished: true,
    deletedAt: null,
    ...(filters.rating ? { rating: filters.rating } : {}),
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(dateRange ? { publishedAt: dateRange } : {}),
    ...(filters.q
      ? {
          OR: [
            { quote: { contains: filters.q, mode: "insensitive" } },
            { title: { contains: filters.q, mode: "insensitive" } },
            { displayName: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  } satisfies Prisma.TestimonialWhereInput;
}

function mapStatus(status: string): TestimonialStatusValue {
  return (status in testimonialStatusLabels ? status : "PENDING_REVIEW") as TestimonialStatusValue;
}

function mapBuyerItem(row: {
  id: string;
  title: string | null;
  quote: string;
  rating: number;
  status: string;
  rejectionReason: string | null;
  isVerifiedBuyer: boolean;
  submittedAt: Date;
  publishedAt: Date | null;
  property: { title: string } | null;
}): BuyerTestimonialItem {
  const status = mapStatus(row.status);

  return {
    id: row.id,
    title: row.title,
    quote: row.quote,
    rating: row.rating,
    status,
    statusLabel: testimonialStatusLabels[status],
    rejectionReason: row.rejectionReason,
    propertyTitle: row.property?.title ?? null,
    isVerifiedBuyer: row.isVerifiedBuyer,
    submittedAt: formatDate(row.submittedAt, "PPP p"),
    publishedAt: row.publishedAt ? formatDate(row.publishedAt, "PPP p") : null,
  };
}

async function resolveBuyer(context: TenantContext, options?: { email?: string | null }) {
  const buyer = await resolveBuyerDbUserForKyc(context, { email: options?.email });

  const user = await prisma.user.findFirst({
    where: {
      id: buyer.id,
      companyId: context.companyId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profileImageUrl: true,
    },
  });

  if (!user) {
    throw new Error("Buyer profile is not available for this tenant.");
  }

  return user;
}

async function resolveBuyerPropertyConnection(input: {
  companyId: string;
  buyerUserId: string;
  propertyId?: string;
}) {
  if (!input.propertyId) {
    return {
      property: null,
      reservationId: null,
      transactionId: null,
      isVerifiedBuyer: false,
    };
  }

  const property = await prisma.property.findFirst({
    where: {
      id: input.propertyId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!property) {
    throw new Error("Selected property is not available for this tenant.");
  }

  const [reservation, transaction] = await Promise.all([
    prisma.reservation.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.buyerUserId,
        propertyId: input.propertyId,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.buyerUserId,
        propertyId: input.propertyId,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!reservation && !transaction) {
    throw new Error("You can only review a property connected to your reservation or transaction.");
  }

  return {
    property,
    reservationId: reservation?.id ?? null,
    transactionId: transaction?.id ?? null,
    isVerifiedBuyer: true,
  };
}

export async function getBuyerTestimonialPropertyOptions(
  context: TenantContext,
  options?: { email?: string | null },
): Promise<TestimonialPropertyOption[]> {
  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return [];
  }

  const buyer = await resolveBuyer(context, options);
  const [reservations, transactions] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        companyId: context.companyId,
        userId: buyer.id,
      },
      select: {
        property: { select: { id: true, title: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        companyId: context.companyId,
        userId: buyer.id,
      },
      select: {
        property: { select: { id: true, title: true } },
      },
    }),
  ]);

  const optionsById = new Map<string, TestimonialPropertyOption>();
  for (const item of [...reservations, ...transactions]) {
    optionsById.set(item.property.id, item.property);
  }

  return Array.from(optionsById.values()).sort((left, right) => left.title.localeCompare(right.title));
}

export async function getBuyerTestimonials(
  context: TenantContext,
  options?: { email?: string | null },
): Promise<BuyerTestimonialItem[]> {
  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return [];
  }

  const buyer = await resolveBuyer(context, options);
  const rows = await prisma.testimonial.findMany({
    where: {
      companyId: context.companyId,
      buyerUserId: buyer.id,
      deletedAt: null,
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      title: true,
      quote: true,
      rating: true,
      status: true,
      rejectionReason: true,
      isVerifiedBuyer: true,
      submittedAt: true,
      publishedAt: true,
      property: { select: { title: true } },
    },
  });

  return rows.map(mapBuyerItem);
}

export async function getBuyerTestimonialDetail(
  context: TenantContext,
  testimonialId: string,
  options?: { email?: string | null },
): Promise<BuyerTestimonialItem | null> {
  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return null;
  }

  const buyer = await resolveBuyer(context, options);
  const row = await prisma.testimonial.findFirst({
    where: {
      id: testimonialId,
      companyId: context.companyId,
      buyerUserId: buyer.id,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      quote: true,
      rating: true,
      status: true,
      rejectionReason: true,
      isVerifiedBuyer: true,
      submittedAt: true,
      publishedAt: true,
      property: { select: { title: true } },
    },
  });

  return row ? mapBuyerItem(row) : null;
}

export async function submitBuyerTestimonial(
  context: TenantContext,
  rawInput: unknown,
  options?: { email?: string | null },
) {
  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  const input = testimonialSubmissionSchema.parse(rawInput);

  if (!featureFlags.hasDatabase) {
    return { id: "demo-testimonial", status: "PENDING_REVIEW" };
  }

  const buyer = await resolveBuyer(context, options);
  const connection = await resolveBuyerPropertyConnection({
    companyId: context.companyId,
    buyerUserId: buyer.id,
    propertyId: input.propertyId,
  });
  const displayName = `${buyer.firstName ?? ""} ${buyer.lastName ?? ""}`.trim() || buyer.email;

  const testimonial = await prisma.testimonial.create({
    data: {
      companyId: context.companyId,
      buyerUserId: buyer.id,
      propertyId: connection.property?.id ?? null,
      reservationId: connection.reservationId,
      transactionId: connection.transactionId,
      fullName: displayName,
      displayName,
      role: connection.isVerifiedBuyer ? "Verified buyer" : "Buyer",
      quote: input.quote,
      title: input.title,
      rating: input.rating,
      avatarUrl: buyer.profileImageUrl,
      isPublished: false,
      status: "PENDING_REVIEW",
      source: "BUYER_PORTAL",
      isVerifiedBuyer: connection.isVerifiedBuyer,
    },
    select: {
      id: true,
      title: true,
      rating: true,
      quote: true,
    },
  });

  const operators = await getTenantOperatorRecipients(context.companyId);
  await notifyManyUsers(operators, {
    companyId: context.companyId,
    type: "TESTIMONIAL_SUBMITTED",
    title: "New testimonial awaiting review",
    body: `${displayName} submitted a ${input.rating}-star testimonial for review.`,
    metadata: {
      entityType: "TESTIMONIAL",
      entityId: testimonial.id,
      actionUrl: `/admin/testimonials/${testimonial.id}`,
      testimonialId: testimonial.id,
    } as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: buyer.id,
    action: "CREATE",
    entityType: "Testimonial",
    entityId: testimonial.id,
    summary: `Buyer testimonial submitted by ${displayName}`,
    payload: {
      propertyId: connection.property?.id ?? null,
      rating: input.rating,
      isVerifiedBuyer: connection.isVerifiedBuyer,
    } as Prisma.InputJsonValue,
  });

  return {
    id: testimonial.id,
    status: "PENDING_REVIEW" as const,
  };
}

export async function resubmitBuyerTestimonial(
  context: TenantContext,
  testimonialId: string,
  rawInput: unknown,
  options?: { email?: string | null },
) {
  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  const input = testimonialResubmissionSchema.parse(rawInput);

  if (!featureFlags.hasDatabase) {
    return { id: testimonialId, status: "PENDING_REVIEW" };
  }

  const buyer = await resolveBuyer(context, options);
  const existing = await prisma.testimonial.findFirst({
    where: {
      id: testimonialId,
      companyId: context.companyId,
      buyerUserId: buyer.id,
      status: { in: ["REJECTED", "UNPUBLISHED"] },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Only rejected or unpublished testimonials can be resubmitted.");
  }

  const connection = await resolveBuyerPropertyConnection({
    companyId: context.companyId,
    buyerUserId: buyer.id,
    propertyId: input.propertyId,
  });

  const updated = await prisma.testimonial.update({
    where: { id: existing.id },
    data: {
      propertyId: connection.property?.id ?? null,
      reservationId: connection.reservationId,
      transactionId: connection.transactionId,
      quote: input.quote,
      title: input.title,
      rating: input.rating,
      status: "PENDING_REVIEW",
      rejectionReason: null,
      isPublished: false,
      unpublishedAt: null,
      submittedAt: new Date(),
      isVerifiedBuyer: connection.isVerifiedBuyer,
    },
    select: { id: true },
  });

  const operators = await getTenantOperatorRecipients(context.companyId);
  await notifyManyUsers(operators, {
    companyId: context.companyId,
    type: "TESTIMONIAL_SUBMITTED",
    title: "Testimonial resubmitted",
    body: `${buyer.email} resubmitted a testimonial for review.`,
    metadata: {
      entityType: "TESTIMONIAL",
      entityId: updated.id,
      actionUrl: `/admin/testimonials/${updated.id}`,
      testimonialId: updated.id,
    } as Prisma.InputJsonValue,
  });

  return {
    id: updated.id,
    status: "PENDING_REVIEW" as const,
  };
}

export async function getAdminTestimonials(
  context: TenantContext,
  filters: {
    status?: string;
    rating?: number;
    propertyId?: string;
    q?: string;
  } = {},
): Promise<AdminTestimonialItem[]> {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return [];
  }

  const rows = (await findManyForTenant(
    prisma.testimonial as ScopedFindManyDelegate,
    context,
    {
      where: {
        deletedAt: filters.status === "DELETED" ? { not: null } : null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.rating ? { rating: filters.rating } : {}),
        ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
        ...(filters.q
          ? {
              OR: [
                { quote: { contains: filters.q, mode: "insensitive" } },
                { title: { contains: filters.q, mode: "insensitive" } },
                { displayName: { contains: filters.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        displayName: true,
        title: true,
        quote: true,
        rating: true,
        avatarUrl: true,
        status: true,
        source: true,
        rejectionReason: true,
        isVerifiedBuyer: true,
        submittedAt: true,
        publishedAt: true,
        property: { select: { title: true } },
        buyer: { select: { email: true } },
      },
    } as Parameters<typeof prisma.testimonial.findMany>[0],
  )) as Array<{
    id: string;
    displayName: string;
    title: string | null;
    quote: string;
    rating: number;
    avatarUrl: string | null;
    status: string;
    source: string;
    rejectionReason: string | null;
    isVerifiedBuyer: boolean;
    submittedAt: Date;
    publishedAt: Date | null;
    property: { title: string } | null;
    buyer: { email: string } | null;
  }>;

  return rows.map((row) => ({
    ...mapBuyerItem(row),
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    source: row.source,
    buyerEmail: row.buyer?.email ?? null,
  }));
}

export async function getAdminTestimonialDetail(
  context: TenantContext,
  testimonialId: string,
): Promise<AdminTestimonialItem | null> {
  const rows = await getAdminTestimonials(context, {});
  return rows.find((item) => item.id === testimonialId) ?? null;
}

export async function moderateTestimonialForAdmin(
  context: TenantContext,
  testimonialId: string,
  rawInput: unknown,
) {
  if (!context.companyId || !context.userId) {
    throw new Error("Tenant context is required.");
  }

  const input = testimonialAdminActionSchema.parse(rawInput);

  if (!featureFlags.hasDatabase) {
    return { id: testimonialId };
  }

  const existing = (await findFirstForTenant(
    prisma.testimonial as ScopedFindFirstDelegate,
    context,
    {
      where: { id: testimonialId },
      select: {
        id: true,
        buyerUserId: true,
        displayName: true,
        status: true,
        source: true,
      },
    } as Parameters<typeof prisma.testimonial.findFirst>[0],
  )) as {
    id: string;
    buyerUserId: string | null;
    displayName: string;
    status: string;
    source: string;
  } | null;

  if (!existing) {
    throw new Error("Testimonial not found.");
  }

  const now = new Date();
  const reviewer = await prisma.user.findFirst({
    where: {
      id: context.userId,
      companyId: context.companyId,
    },
    select: { id: true },
  });
  const reviewerData = reviewer
    ? {
        reviewedBy: { connect: { id: reviewer.id } },
      }
    : {};
  const data: Prisma.TestimonialUpdateInput =
    input.action === "APPROVE"
      ? {
          status: "APPROVED",
          isPublished: false,
          reviewedAt: now,
          ...reviewerData,
          adminNote: input.adminNote ?? null,
          rejectionReason: null,
        }
      : input.action === "APPROVE_AND_PUBLISH"
        ? {
            status: "PUBLISHED",
            isPublished: true,
            reviewedAt: now,
            ...reviewerData,
            publishedAt: now,
            unpublishedAt: null,
            adminNote: input.adminNote ?? null,
            rejectionReason: null,
          }
        : input.action === "REJECT"
          ? {
              status: "REJECTED",
              isPublished: false,
              reviewedAt: now,
              ...reviewerData,
              rejectionReason: input.rejectionReason,
              adminNote: input.adminNote ?? null,
              unpublishedAt: now,
            }
          : input.action === "PUBLISH"
            ? {
                status: "PUBLISHED",
                isPublished: true,
                publishedAt: now,
                unpublishedAt: null,
              }
            : input.action === "UNPUBLISH"
              ? {
                  status: "UNPUBLISHED",
                  isPublished: false,
                  unpublishedAt: now,
                }
              : {
                  status: "DELETED",
                  isPublished: false,
                  deletedAt: now,
                  unpublishedAt: now,
                };

  const updated = await prisma.testimonial.update({
    where: { id: existing.id },
    data,
    select: {
      id: true,
      status: true,
      buyerUserId: true,
      rejectionReason: true,
    },
  });

  if (updated.buyerUserId) {
    const notification =
      updated.status === "REJECTED"
        ? {
            type: "TESTIMONIAL_REVIEWED" as const,
            title: "Your testimonial needs changes",
            body: `Your testimonial was not approved. Reason: ${updated.rejectionReason ?? "Please review and resubmit."}`,
          }
        : updated.status === "PUBLISHED"
          ? {
              type: "TESTIMONIAL_PUBLISHED" as const,
              title: "Your testimonial is live",
              body: "Your testimonial has been published on the company website.",
            }
          : updated.status === "APPROVED"
            ? {
                type: "TESTIMONIAL_REVIEWED" as const,
                title: "Your testimonial was approved",
                body: "Your testimonial was approved and is waiting to be published.",
              }
            : null;

    if (notification) {
      await createInAppNotification({
        companyId: context.companyId,
        userId: updated.buyerUserId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: {
          entityType: "TESTIMONIAL",
          entityId: updated.id,
          actionUrl: `/portal/testimonials/${updated.id}`,
          testimonialId: updated.id,
          rejectionReason: updated.rejectionReason,
        } as Prisma.InputJsonValue,
      });
    }
  }

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: input.action === "DELETE" ? "DELETE" : "UPDATE",
    entityType: "Testimonial",
    entityId: updated.id,
    summary: `Testimonial ${updated.id} moved to ${updated.status}`,
    payload: {
      action: input.action,
      previousStatus: existing.status,
      nextStatus: updated.status,
    } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function getPublicTestimonials(
  context: TenantContext,
  rawFilters: unknown = {},
  options: { limit?: number } = {},
): Promise<PublicTestimonialCard[]> {
  const filters = publicTestimonialsFilterSchema.parse(rawFilters);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  const rows = (await findManyForTenant(
    prisma.testimonial as ScopedFindManyDelegate,
    context,
    {
      where: buildPublicTestimonialsWhere(filters),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: options.limit,
      select: {
        id: true,
        displayName: true,
        role: true,
        companyName: true,
        quote: true,
        title: true,
        rating: true,
        avatarUrl: true,
        isVerifiedBuyer: true,
        publishedAt: true,
        createdAt: true,
        property: { select: { title: true } },
      },
    } as Parameters<typeof prisma.testimonial.findMany>[0],
  )) as Array<{
    id: string;
    displayName: string;
    role: string | null;
    companyName: string | null;
    quote: string;
    title: string | null;
    rating: number;
    avatarUrl: string | null;
    isVerifiedBuyer: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    property: { title: string } | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    role: row.role ?? "Buyer",
    company: row.companyName ?? undefined,
    quote: row.quote,
    title: row.title ?? undefined,
    rating: row.rating,
    avatarUrl: row.avatarUrl,
    isVerifiedBuyer: row.isVerifiedBuyer,
    propertyTitle: row.property?.title ?? null,
    publishedAt: formatDate(row.publishedAt ?? row.createdAt, "PPP"),
  }));
}

export async function getPublicTestimonialPropertyOptions(
  context: TenantContext,
): Promise<TestimonialPropertyOption[]> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  const rows = await prisma.testimonial.findMany({
    where: {
      companyId: context.companyId,
      status: "PUBLISHED",
      isPublished: true,
      deletedAt: null,
      propertyId: { not: null },
    },
    select: {
      property: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    distinct: ["propertyId"],
    orderBy: { publishedAt: "desc" },
  });

  return rows
    .map((row) => row.property)
    .filter((property): property is TestimonialPropertyOption => Boolean(property))
    .sort((left, right) => left.title.localeCompare(right.title));
}
