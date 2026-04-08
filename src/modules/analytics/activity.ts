import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";

type ProductEventInput = {
  companyId: string;
  userId?: string | null;
  inquiryId?: string | null;
  eventName: string;
  summary: string;
  payload?: Prisma.InputJsonValue;
};

type FirstEventInput = ProductEventInput & {
  actorUserId?: string | null;
};

export const PRODUCT_EVENT_NAMES = {
  companyCreated: "company.created",
  companyOnboarded: "company.onboarded",
  companySuspended: "company.suspended",
  companyReactivated: "company.reactivated",
  propertyCreated: "property.created",
  firstPropertyCreated: "property.first_created",
  teamMemberAdded: "team_member.added",
  firstTeamMemberAdded: "team_member.first_added",
  dealCreated: "deal.created",
  firstDealCreated: "deal.first_created",
  inquiryCreated: "inquiry.created",
  inspectionBooked: "inspection.booked",
  reservationCreated: "reservation.created",
  paymentRequestSent: "payment_request.sent",
  paymentCompleted: "payment.completed",
  overduePaymentDetected: "payment.overdue_detected",
  dealClosed: "deal.closed",
  sampleWorkspaceLoaded: "sample_workspace.loaded",
} as const;

export async function trackProductEvent(input: ProductEventInput) {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  return prisma.activityEvent.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      inquiryId: input.inquiryId ?? null,
      eventName: input.eventName,
      summary: input.summary,
      payload: input.payload,
    },
  });
}

export async function trackFirstCompanyEvent(input: FirstEventInput) {
  if (!featureFlags.hasDatabase) {
    return false;
  }

  const existing = await prisma.activityEvent.findFirst({
    where: {
      companyId: input.companyId,
      eventName: input.eventName,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return false;
  }

  await trackProductEvent(input);
  return true;
}

export async function ensureCompanyOnboardedEvent(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return false;
  }

  const [propertyCount, teamCount, dealCount] = await Promise.all([
    prisma.property.count({
      where: {
        companyId: context.companyId,
      },
    }),
    prisma.teamMember.count({
      where: {
        companyId: context.companyId,
      },
    }),
    prisma.reservation.count({
      where: {
        companyId: context.companyId,
      },
    }),
  ]);

  if (propertyCount < 1 || teamCount < 1 || dealCount < 1) {
    return false;
  }

  return trackFirstCompanyEvent({
    companyId: context.companyId,
    userId: context.userId,
    eventName: PRODUCT_EVENT_NAMES.companyOnboarded,
    summary: "Company completed the first developer sales workflow setup.",
    payload: {
      properties: propertyCount,
      teamMembers: teamCount,
      deals: dealCount,
    } as Prisma.InputJsonValue,
  });
}
