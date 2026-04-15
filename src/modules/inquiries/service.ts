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
import { inquirySchema, inquiryUpdateSchema } from "@/lib/validations/inquiries";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

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
    body: `${inquiry.fullName} submitted an inquiry${inquiry.property?.title ? ` for ${inquiry.property.title}` : ""}.`,
    metadata: {
      inquiryId: inquiry.id,
      propertyId: inquiry.propertyId,
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
    where: { id: inquiryId },
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

  return updated;
}
