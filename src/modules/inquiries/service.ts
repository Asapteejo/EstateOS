import type { InquiryStatus, LeadSource, Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { publishDomainEvent } from "@/lib/notifications/events";
import { createInAppNotification, getTenantOperatorRecipients, notifyManyUsers } from "@/lib/notifications/service";
import { renderInquiryReceivedEmail, renderOperatorInquiryAlert } from "@/lib/notifications/templates";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant } from "@/lib/tenancy/db";
import { inquiryReplySchema, inquirySchema, inquiryUpdateSchema, portalInquirySchema } from "@/lib/validations/inquiries";
import { resolveBuyerDbUserForKyc } from "@/modules/kyc/buyer-user";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

function buildSnippet(message: string, maxLength = 160) {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

export type InquiryManagementItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  message: string;
  source: string;
  status: string;
  propertyTitle: string;
  assignedStaffId: string | null;
  assignedStaffName: string;
  notes: string | null;
  createdAt: string;
};

export type InquiryReplyItem = {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
};

export type InquiryDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  message: string;
  source: string;
  status: string;
  propertyTitle: string;
  notes: string | null;
  createdAt: string;
  replies: InquiryReplyItem[];
};

export function canTransitionInquiryStatus(
  current: InquiryStatus,
  next: InquiryStatus,
) {
  const allowed: Record<InquiryStatus, InquiryStatus[]> = {
    NEW: ["CONTACTED", "QUALIFIED", "INSPECTION_BOOKED", "CLOSED", "LOST"],
    CONTACTED: ["QUALIFIED", "INSPECTION_BOOKED", "CLOSED", "LOST"],
    INSPECTION_BOOKED: ["QUALIFIED", "CONVERTED", "CLOSED"],
    QUALIFIED: ["INSPECTION_BOOKED", "CONVERTED", "CLOSED"],
    CONVERTED: ["CLOSED"],
    CLOSED: [],
    LOST: [],
  };

  return current === next || allowed[current].includes(next);
}

const portalInquiryCategoryLabels = {
  PROPERTY_GUIDANCE: "Property guidance",
  AVAILABILITY: "Availability",
  PAYMENT_STEPS: "Payment steps",
  DOCUMENTS: "Documents",
  OTHER: "Other",
} as const;

export function buildPortalInquiryMessage(input: {
  category: keyof typeof portalInquiryCategoryLabels;
  message: string;
}) {
  return `[Portal inquiry - ${portalInquiryCategoryLabels[input.category]}]\n\n${input.message.trim()}`;
}

export async function getAssignableStaffOptions(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  return (await findManyForTenant(
    prisma.staffProfile as ScopedFindManyDelegate,
    context,
    {
      where: {
        isAssignable: true,
      },
      orderBy: {
        user: {
          firstName: "asc",
        },
      },
      select: {
        id: true,
        title: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.staffProfile.findMany>[0],
    { modelName: "StaffProfile", strategy: "staffProfileUserCompanyId" },
  )) as Array<{
    id: string;
    title: string | null;
    user: { firstName: string | null; lastName: string | null; companyId: string | null };
  }>;
}

export async function getInquiryManagementList(context: TenantContext): Promise<InquiryManagementItem[]> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  const inquiries = (await findManyForTenant(
    prisma.inquiry as ScopedFindManyDelegate,
    context,
    {
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        message: true,
        source: true,
        status: true,
        notes: true,
        createdAt: true,
        property: {
          select: {
            title: true,
            companyId: true,
          },
        },
        assignedStaff: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                companyId: true,
              },
            },
          },
        },
      },
    } as Parameters<typeof prisma.inquiry.findMany>[0],
  )) as Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    message: string;
    source: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    property: { title: string; companyId: string } | null;
    assignedStaff: {
      id: string;
      user: { firstName: string | null; lastName: string | null; companyId: string | null };
    } | null;
  }>;

  return inquiries.map((inquiry) => ({
    id: inquiry.id,
    fullName: inquiry.fullName,
    email: inquiry.email,
    phone: inquiry.phone,
    message: inquiry.message,
    source: inquiry.source,
    status: inquiry.status,
    propertyTitle:
      inquiry.property?.companyId === context.companyId ? inquiry.property.title : "General inquiry",
    assignedStaffId: inquiry.assignedStaff?.id ?? null,
    assignedStaffName:
      inquiry.assignedStaff?.user.companyId === context.companyId
        ? `${inquiry.assignedStaff.user.firstName ?? ""} ${inquiry.assignedStaff.user.lastName ?? ""}`.trim() ||
          "Assigned staff"
        : "Unassigned",
    notes: inquiry.notes,
    createdAt: inquiry.createdAt.toISOString(),
  }));
}

function mapReplyEvent(event: {
  id: string;
  summary: string;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  const payload =
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {};

  return {
    id: event.id,
    message: typeof payload.message === "string" ? payload.message : event.summary,
    authorName: typeof payload.authorName === "string" ? payload.authorName : "Sales team",
    createdAt: event.createdAt.toISOString(),
  };
}

export async function getInquiryDetailForAdmin(
  context: TenantContext,
  inquiryId: string,
): Promise<InquiryDetail | null> {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return null;
  }

  const inquiry = (await findFirstForTenant(
    prisma.inquiry as ScopedFindFirstDelegate,
    context,
    {
      where: { id: inquiryId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        message: true,
        source: true,
        status: true,
        notes: true,
        createdAt: true,
        property: { select: { title: true } },
        activities: {
          where: { eventName: "inquiry.reply.sent" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            summary: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    } as Parameters<typeof prisma.inquiry.findFirst>[0],
  )) as {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    message: string;
    source: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    property: { title: string } | null;
    activities: Array<{
      id: string;
      summary: string;
      payload: Prisma.JsonValue | null;
      createdAt: Date;
    }>;
  } | null;

  if (!inquiry) {
    return null;
  }

  return {
    id: inquiry.id,
    fullName: inquiry.fullName,
    email: inquiry.email,
    phone: inquiry.phone,
    message: inquiry.message,
    source: inquiry.source,
    status: inquiry.status,
    notes: inquiry.notes,
    propertyTitle: inquiry.property?.title ?? "General inquiry",
    createdAt: inquiry.createdAt.toISOString(),
    replies: inquiry.activities.map(mapReplyEvent),
  };
}

export async function getInquiryDetailForBuyer(
  context: TenantContext,
  inquiryId: string,
): Promise<InquiryDetail | null> {
  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return null;
  }

  const inquiry = (await findFirstForTenant(
    prisma.inquiry as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: inquiryId,
        userId: context.userId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        message: true,
        source: true,
        status: true,
        notes: true,
        createdAt: true,
        property: { select: { title: true } },
        activities: {
          where: { eventName: "inquiry.reply.sent" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            summary: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    } as Parameters<typeof prisma.inquiry.findFirst>[0],
  )) as {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    message: string;
    source: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    property: { title: string } | null;
    activities: Array<{
      id: string;
      summary: string;
      payload: Prisma.JsonValue | null;
      createdAt: Date;
    }>;
  } | null;

  if (!inquiry) {
    return null;
  }

  return {
    id: inquiry.id,
    fullName: inquiry.fullName,
    email: inquiry.email,
    phone: inquiry.phone,
    message: inquiry.message,
    source: inquiry.source,
    status: inquiry.status,
    notes: null,
    propertyTitle: inquiry.property?.title ?? "General inquiry",
    createdAt: inquiry.createdAt.toISOString(),
    replies: inquiry.activities.map(mapReplyEvent),
  };
}

export async function createInquiry(
  tenant: TenantContext,
  rawInput: unknown,
  viewer?: TenantContext | null,
) {
  const parsed = inquirySchema.parse(rawInput);

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return { id: "demo-inquiry", ...parsed, status: "NEW" };
  }

  const property = parsed.propertyId
    ? ((await findFirstForTenant(
        prisma.property as ScopedFindFirstDelegate,
        tenant,
        {
          where: { id: parsed.propertyId },
          select: { id: true },
        } as Parameters<typeof prisma.property.findFirst>[0],
      )) as { id: string } | null)
    : null;

  if (parsed.propertyId && !property) {
    throw new Error("Property not found for inquiry.");
  }

  const source = (parsed.source ?? "WEBSITE") as LeadSource;
  const inquiry = await prisma.inquiry.create({
    data: {
      companyId: tenant.companyId,
      propertyId: property?.id,
      userId: viewer?.userId ?? null,
      fullName: parsed.fullName,
      email: parsed.email,
      phone: parsed.phone,
      message: parsed.message,
      source,
      status: "NEW",
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      propertyId: true,
      fullName: true,
      email: true,
      property: {
        select: {
          title: true,
        },
      },
    },
  });

  const company = await prisma.company.findUnique({
    where: { id: tenant.companyId },
    select: { name: true },
  });
  const companyName = company?.name ?? "EstateOS";

  const operators = await getTenantOperatorRecipients(tenant.companyId);
  await notifyManyUsers(operators, {
    companyId: tenant.companyId,
    type: "INQUIRY_RECEIVED",
    title: "New inquiry received",
    body: `${inquiry.fullName} submitted an inquiry${inquiry.property?.title ? ` for ${inquiry.property.title}` : ""}. ${buildSnippet(parsed.message)}`,
    metadata: {
      inquiryId: inquiry.id,
      entityType: "INQUIRY",
      entityId: inquiry.id,
      actionUrl: `/admin/inquiries/${inquiry.id}`,
      propertyId: inquiry.propertyId,
      snippet: buildSnippet(parsed.message),
    } as Prisma.InputJsonValue,
    emailSubject: `New inquiry — ${inquiry.property?.title ?? inquiry.fullName}`,
    emailHtml: renderOperatorInquiryAlert({
      buyerName: inquiry.fullName,
      propertyTitle: inquiry.property?.title,
      companyName,
    }),
  });

  if (inquiry.userId) {
    await createInAppNotification({
      companyId: tenant.companyId,
      userId: inquiry.userId,
      type: "INQUIRY_RECEIVED",
      title: "Inquiry received",
      body: "Your inquiry has been received and routed to the sales team.",
      metadata: {
        inquiryId: inquiry.id,
        entityType: "INQUIRY",
        entityId: inquiry.id,
        actionUrl: `/portal/inquiries/${inquiry.id}`,
      } as Prisma.InputJsonValue,
    });
  }

  const { subject: inquirySubject, html: inquiryHtml } = renderInquiryReceivedEmail({
    fullName: inquiry.fullName,
    propertyTitle: inquiry.property?.title,
    companyName,
  });
  await sendTransactionalEmail({ to: inquiry.email, subject: inquirySubject, html: inquiryHtml });

  await publishDomainEvent("inquiry/received", {
    companyId: tenant.companyId,
    inquiryId: inquiry.id,
    propertyId: inquiry.propertyId,
    fullName: inquiry.fullName,
    email: inquiry.email,
  });

  await writeAuditLog({
    companyId: tenant.companyId,
    actorUserId: viewer?.userId ?? undefined,
    action: "CREATE",
    entityType: "Inquiry",
    entityId: inquiry.id,
    summary: `Inquiry received from ${inquiry.fullName}`,
    payload: {
      propertyId: inquiry.propertyId,
      source,
    } as Prisma.InputJsonValue,
  });

  await trackProductEvent({
    companyId: tenant.companyId,
    eventName: PRODUCT_EVENT_NAMES.inquiryCreated,
    summary: `Inquiry received from ${inquiry.fullName}`,
    userId: inquiry.userId ?? undefined,
    inquiryId: inquiry.id,
    payload: {
      propertyId: inquiry.propertyId,
      source,
    } as Prisma.InputJsonValue,
  });

  return inquiry;
}

export async function createPortalInquiry(
  tenant: TenantContext,
  rawInput: unknown,
  options?: { email?: string | null },
) {
  const parsed = portalInquirySchema.parse(rawInput);

  if (!tenant.companyId || !tenant.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      id: "demo-portal-inquiry",
      companyName: tenant.companySlug ?? "Tenant company",
    };
  }

  const buyer = await resolveBuyerDbUserForKyc(tenant, {
    email: options?.email,
  });

  const user = await prisma.user.findFirst({
    where: {
      id: buyer.id,
      companyId: tenant.companyId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });

  if (!user) {
    throw new Error("Buyer profile is not available for this tenant.");
  }

  const property = parsed.propertyId
    ? ((await findFirstForTenant(
        prisma.property as ScopedFindFirstDelegate,
        tenant,
        {
          where: { id: parsed.propertyId },
          select: { id: true, title: true },
        } as Parameters<typeof prisma.property.findFirst>[0],
      )) as { id: string; title: string } | null)
    : null;

  if (parsed.propertyId && !property) {
    throw new Error("Property not found for inquiry.");
  }

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
  const message = buildPortalInquiryMessage({
    category: parsed.category,
    message: parsed.message,
  });

  const inquiry = await prisma.inquiry.create({
    data: {
      companyId: tenant.companyId,
      propertyId: property?.id,
      userId: user.id,
      fullName,
      email: user.email,
      phone: user.phone,
      message,
      source: "WEBSITE",
      status: "NEW",
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      propertyId: true,
      fullName: true,
      email: true,
    },
  });

  const company = await prisma.company.findUnique({
    where: { id: tenant.companyId },
    select: { name: true, siteSetting: { select: { companyName: true } } },
  });
  const companyName = company?.siteSetting?.companyName ?? company?.name ?? "your company";

  const operators = await getTenantOperatorRecipients(tenant.companyId);
  await notifyManyUsers(operators, {
    companyId: tenant.companyId,
    type: "INQUIRY_RECEIVED",
    title: "Buyer portal inquiry",
    body: `${fullName} sent a ${portalInquiryCategoryLabels[parsed.category].toLowerCase()} inquiry${property?.title ? ` about ${property.title}` : ""}. ${buildSnippet(parsed.message)}`,
    metadata: {
      inquiryId: inquiry.id,
      entityType: "INQUIRY",
      entityId: inquiry.id,
      actionUrl: `/admin/inquiries/${inquiry.id}`,
      propertyId: property?.id ?? null,
      source: "PORTAL",
      category: parsed.category,
      categoryLabel: portalInquiryCategoryLabels[parsed.category],
      buyerName: fullName,
      snippet: buildSnippet(parsed.message),
    } as Prisma.InputJsonValue,
    emailSubject: `Buyer portal inquiry - ${property?.title ?? fullName}`,
    emailHtml: renderOperatorInquiryAlert({
      buyerName: fullName,
      propertyTitle: property?.title,
      companyName,
    }),
  });

  await createInAppNotification({
    companyId: tenant.companyId,
    userId: user.id,
    type: "INQUIRY_RECEIVED",
    title: "Inquiry sent",
    body: `Your inquiry has been sent to ${companyName} sales team.`,
    metadata: {
      inquiryId: inquiry.id,
      entityType: "INQUIRY",
      entityId: inquiry.id,
      actionUrl: `/portal/inquiries/${inquiry.id}`,
      category: parsed.category,
    } as Prisma.InputJsonValue,
  });

  await publishDomainEvent("inquiry/received", {
    companyId: tenant.companyId,
    inquiryId: inquiry.id,
    propertyId: inquiry.propertyId,
    fullName: inquiry.fullName,
    email: inquiry.email,
  });

  await writeAuditLog({
    companyId: tenant.companyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Inquiry",
    entityId: inquiry.id,
    summary: `Portal inquiry received from ${fullName}`,
    payload: {
      propertyId: inquiry.propertyId,
      source: "PORTAL",
      category: parsed.category,
    } as Prisma.InputJsonValue,
  });

  await trackProductEvent({
    companyId: tenant.companyId,
    eventName: PRODUCT_EVENT_NAMES.inquiryCreated,
    summary: `Portal inquiry received from ${fullName}`,
    userId: user.id,
    inquiryId: inquiry.id,
    payload: {
      propertyId: inquiry.propertyId,
      source: "PORTAL",
      category: parsed.category,
    } as Prisma.InputJsonValue,
  });

  return {
    id: inquiry.id,
    companyName,
  };
}

export async function updateInquiryForAdmin(
  context: TenantContext,
  inquiryId: string,
  rawInput: unknown,
) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  const input = inquiryUpdateSchema.parse(rawInput);

  if (!featureFlags.hasDatabase) {
    return { id: inquiryId, ...input };
  }

  const inquiry = (await findFirstForTenant(
    prisma.inquiry as ScopedFindFirstDelegate,
    context,
    {
      where: { id: inquiryId },
      select: {
        id: true,
        userId: true,
        status: true,
        assignedStaffId: true,
      },
    } as Parameters<typeof prisma.inquiry.findFirst>[0],
  )) as {
    id: string;
    userId: string | null;
    status: InquiryStatus;
    assignedStaffId: string | null;
  } | null;

  if (!inquiry) {
    throw new Error("Inquiry not found.");
  }

  if (!canTransitionInquiryStatus(inquiry.status, input.status as InquiryStatus)) {
    throw new Error("Invalid inquiry status transition.");
  }

  if (input.assignedStaffId) {
    const assignedStaff = (await findFirstForTenant(
      prisma.staffProfile as ScopedFindFirstDelegate,
      context,
      {
        where: { id: input.assignedStaffId, isAssignable: true },
        select: { id: true, user: { select: { id: true, firstName: true, email: true } } },
      } as Parameters<typeof prisma.staffProfile.findFirst>[0],
      { modelName: "StaffProfile", strategy: "staffProfileUserCompanyId" },
    )) as {
      id: string;
      user: { id: string; firstName: string | null; email: string };
    } | null;

    if (!assignedStaff) {
      throw new Error("Assigned staff profile not found.");
    }
  }

  const updated = await prisma.inquiry.update({
    where: { id: inquiryId, companyId: context.companyId },
    data: {
      status: input.status,
      assignedStaffId: input.assignedStaffId ?? null,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      userId: true,
      status: true,
      assignedStaffId: true,
      assignedStaff: {
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (updated.userId) {
    await createInAppNotification({
      companyId: context.companyId,
      userId: updated.userId,
      type: updated.status === "CONVERTED" ? "RESERVATION_CREATED" : "INQUIRY_RECEIVED",
      title: "Inquiry updated",
      body: `Your inquiry is now ${updated.status.toLowerCase().replaceAll("_", " ")}.`,
      metadata: {
        inquiryId,
        status: updated.status,
      } as Prisma.InputJsonValue,
    });
  }

  if (updated.assignedStaff?.user.id && updated.assignedStaffId !== inquiry.assignedStaffId) {
    const assignedCompany = await prisma.company.findUnique({
      where: { id: context.companyId },
      select: { name: true },
    });
    await notifyManyUsers([updated.assignedStaff.user], {
      companyId: context.companyId,
      type: "INQUIRY_ASSIGNED",
      title: "Inquiry assigned to you",
      body: "A new inquiry has been assigned to your queue.",
      metadata: {
        inquiryId,
      } as Prisma.InputJsonValue,
      emailSubject: "Inquiry assigned to you",
      emailHtml: renderOperatorInquiryAlert({
        buyerName: "a client",
        companyName: assignedCompany?.name ?? "EstateOS",
      }),
    });
  }

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "Inquiry",
    entityId: inquiryId,
    summary: `Updated inquiry ${inquiryId}`,
    payload: {
      previousStatus: inquiry.status,
      nextStatus: updated.status,
      assignedStaffId: updated.assignedStaffId,
    } as Prisma.InputJsonValue,
  });

  // Propagate follow-up timestamp to any active transaction for this buyer so
  // the risk scoring engine does not incorrectly flag deals as un-followed-up.
  if (inquiry.userId) {
    await prisma.transaction.updateMany({
      where: {
        companyId: context.companyId,
        userId: inquiry.userId,
        currentStage: { notIn: ["FINAL_PAYMENT_COMPLETED", "HANDOVER_COMPLETED"] },
      },
      data: { lastFollowedUpAt: new Date() },
    });
  }

  return updated;
}

export async function replyToInquiryForAdmin(
  context: TenantContext,
  inquiryId: string,
  rawInput: unknown,
) {
  if (!context.companyId || !context.userId) {
    throw new Error("Tenant context is required.");
  }

  const input = inquiryReplySchema.parse(rawInput);

  if (!featureFlags.hasDatabase) {
    return {
      id: "demo-inquiry-reply",
      message: input.message,
    };
  }

  const inquiry = (await findFirstForTenant(
    prisma.inquiry as ScopedFindFirstDelegate,
    context,
    {
      where: { id: inquiryId },
      select: {
        id: true,
        companyId: true,
        userId: true,
        fullName: true,
        email: true,
        property: { select: { title: true } },
      },
    } as Parameters<typeof prisma.inquiry.findFirst>[0],
  )) as {
    id: string;
    companyId: string;
    userId: string | null;
    fullName: string;
    email: string;
    property: { title: string } | null;
  } | null;

  if (!inquiry) {
    throw new Error("Inquiry not found.");
  }

  if (!inquiry.userId) {
    throw new Error("This inquiry is not linked to a portal buyer.");
  }

  const [company, actor] = await Promise.all([
    prisma.company.findUnique({
      where: { id: context.companyId },
      select: { name: true, siteSetting: { select: { companyName: true } } },
    }),
    prisma.user.findFirst({
      where: { id: context.userId, companyId: context.companyId },
      select: { firstName: true, lastName: true, email: true },
    }),
  ]);

  const companyName = company?.siteSetting?.companyName ?? company?.name ?? "Your sales team";
  const actorName =
    `${actor?.firstName ?? ""} ${actor?.lastName ?? ""}`.trim() ||
    actor?.email ||
    "Sales team";
  const snippet = buildSnippet(input.message);

  const reply = await prisma.activityEvent.create({
    data: {
      companyId: context.companyId,
      userId: inquiry.userId,
      inquiryId: inquiry.id,
      eventName: "inquiry.reply.sent",
      summary: `${companyName} replied to ${inquiry.fullName}`,
      payload: {
        message: input.message,
        snippet,
        authorName: actorName,
        companyName,
      } as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  await createInAppNotification({
    companyId: context.companyId,
    userId: inquiry.userId,
    type: "INQUIRY_RECEIVED",
    title: `${companyName} replied to your inquiry`,
    body: snippet,
    metadata: {
      inquiryId: inquiry.id,
      entityType: "INQUIRY",
      entityId: inquiry.id,
      actionUrl: `/portal/inquiries/${inquiry.id}`,
      snippet,
      replyId: reply.id,
    } as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "UPDATE",
    entityType: "Inquiry",
    entityId: inquiry.id,
    summary: `Replied to inquiry ${inquiry.id}`,
    payload: {
      replyId: reply.id,
      propertyTitle: inquiry.property?.title ?? null,
    } as Prisma.InputJsonValue,
  });

  return {
    id: reply.id,
    message: input.message,
    createdAt: reply.createdAt.toISOString(),
  };
}
