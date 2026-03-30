import type { InspectionStatus, Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { publishDomainEvent } from "@/lib/notifications/events";
import { createInAppNotification, getTenantOperatorRecipients, notifyManyUsers } from "@/lib/notifications/service";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant } from "@/lib/tenancy/db";
import { inspectionSchema, inspectionUpdateSchema } from "@/lib/validations/inquiries";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export type InspectionManagementItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  propertyTitle: string;
  scheduledFor: string;
  status: string;
  assignedStaffId: string | null;
  assignedStaffName: string;
  notes: string | null;
};

export function canTransitionInspectionStatus(
  current: InspectionStatus,
  next: InspectionStatus,
) {
  const allowed: Record<InspectionStatus, InspectionStatus[]> = {
    PENDING: ["REQUESTED", "CONFIRMED", "CANCELLED"],
    REQUESTED: ["CONFIRMED", "RESCHEDULED", "CANCELLED"],
    CONFIRMED: ["RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"],
    RESCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: ["RESCHEDULED", "CANCELLED"],
  };

  return current === next || allowed[current].includes(next);
}

export async function getInspectionManagementList(context: TenantContext): Promise<InspectionManagementItem[]> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  const bookings = (await findManyForTenant(
    prisma.inspectionBooking as ScopedFindManyDelegate,
    context,
    {
      orderBy: {
        scheduledFor: "asc",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        scheduledFor: true,
        status: true,
        notes: true,
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
    } as Parameters<typeof prisma.inspectionBooking.findMany>[0],
  )) as Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    scheduledFor: Date;
    status: string;
    notes: string | null;
    property: { title: string; companyId: string };
    assignedStaff: {
      id: string;
      user: { firstName: string | null; lastName: string | null; companyId: string | null };
    } | null;
  }>;

  return bookings.map((booking) => ({
    id: booking.id,
    fullName: booking.fullName,
    email: booking.email,
    phone: booking.phone,
    propertyTitle: booking.property.companyId === context.companyId ? booking.property.title : "Property",
    scheduledFor: booking.scheduledFor.toISOString(),
    status: booking.status,
    assignedStaffId: booking.assignedStaff?.id ?? null,
    assignedStaffName:
      booking.assignedStaff?.user.companyId === context.companyId
        ? `${booking.assignedStaff.user.firstName ?? ""} ${booking.assignedStaff.user.lastName ?? ""}`.trim() ||
          "Assigned staff"
        : "Unassigned",
    notes: booking.notes,
  }));
}

export async function createInspectionBooking(
  tenant: TenantContext,
  rawInput: unknown,
  viewer?: TenantContext | null,
) {
  const parsed = inspectionSchema.parse(rawInput);

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return { id: "demo-inspection", ...parsed, status: "REQUESTED" };
  }

  const property = (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    tenant,
    {
      where: { id: parsed.propertyId },
      select: { id: true, title: true },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as { id: string; title: string } | null;

  if (!property) {
    throw new Error("Property not found for inspection.");
  }

  const inquiry = parsed.inquiryId
    ? ((await findFirstForTenant(
        prisma.inquiry as ScopedFindFirstDelegate,
        tenant,
        {
          where: { id: parsed.inquiryId },
          select: { id: true },
        } as Parameters<typeof prisma.inquiry.findFirst>[0],
      )) as { id: string } | null)
    : null;

  if (parsed.inquiryId && !inquiry) {
    throw new Error("Inquiry not found for inspection.");
  }

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.inspectionBooking.create({
      data: {
        companyId: tenant.companyId!,
        propertyId: property.id,
        inquiryId: inquiry?.id ?? null,
        userId: viewer?.userId ?? null,
        fullName: parsed.fullName,
        email: parsed.email,
        phone: parsed.phone,
        scheduledFor: new Date(parsed.scheduledFor),
        status: "REQUESTED",
      },
      select: {
        id: true,
        companyId: true,
        userId: true,
        propertyId: true,
        inquiryId: true,
        fullName: true,
        email: true,
      },
    });

    if (inquiry?.id) {
      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: { status: "INSPECTION_BOOKED" },
      });
    }

    return created;
  });

  const operators = await getTenantOperatorRecipients(tenant.companyId);
  await notifyManyUsers(operators, {
    companyId: tenant.companyId,
    type: "INSPECTION_BOOKED",
    title: "Inspection requested",
    body: `${booking.fullName} requested a site visit for ${property.title}.`,
    metadata: {
      inspectionId: booking.id,
      propertyId: booking.propertyId,
      inquiryId: booking.inquiryId,
    } as Prisma.InputJsonValue,
    emailSubject: "New EstateOS inspection request",
    emailHtml: (recipient) =>
      `<p>Hi ${recipient},</p><p>${booking.fullName} requested an inspection for ${property.title}.</p>`,
  });

  if (booking.userId) {
    await createInAppNotification({
      companyId: tenant.companyId,
      userId: booking.userId,
      type: "INSPECTION_BOOKED",
      title: "Inspection requested",
      body: `Your inspection request for ${property.title} has been submitted.`,
      metadata: {
        inspectionId: booking.id,
      } as Prisma.InputJsonValue,
    });
  }

  await sendTransactionalEmail({
    to: booking.email,
    subject: "Your EstateOS inspection request was received",
    html: `<p>Hi ${booking.fullName},</p><p>Your inspection request for ${property.title} has been received and is awaiting confirmation.</p>`,
  });

  await publishDomainEvent("inspection/booked", {
    companyId: tenant.companyId,
    inspectionId: booking.id,
    propertyId: booking.propertyId,
    inquiryId: booking.inquiryId,
    fullName: booking.fullName,
    email: booking.email,
  });

  await writeAuditLog({
    companyId: tenant.companyId,
    actorUserId: viewer?.userId ?? undefined,
    action: "CREATE",
    entityType: "InspectionBooking",
    entityId: booking.id,
    summary: `Inspection requested by ${booking.fullName}`,
    payload: {
      propertyId: booking.propertyId,
      inquiryId: booking.inquiryId,
    } as Prisma.InputJsonValue,
  });

  return booking;
}

export async function updateInspectionBookingForAdmin(
  context: TenantContext,
  bookingId: string,
  rawInput: unknown,
) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  const input = inspectionUpdateSchema.parse(rawInput);

  if (!featureFlags.hasDatabase) {
    return { id: bookingId, ...input };
  }

  const booking = (await findFirstForTenant(
    prisma.inspectionBooking as ScopedFindFirstDelegate,
    context,
    {
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        email: true,
        status: true,
        assignedStaffId: true,
      },
    } as Parameters<typeof prisma.inspectionBooking.findFirst>[0],
  )) as {
    id: string;
    userId: string | null;
    email: string;
    status: InspectionStatus;
    assignedStaffId: string | null;
  } | null;

  if (!booking) {
    throw new Error("Inspection booking not found.");
  }

  if (!canTransitionInspectionStatus(booking.status, input.status as InspectionStatus)) {
    throw new Error("Invalid inspection status transition.");
  }

  if (input.assignedStaffId) {
    const assignedStaff = await findFirstForTenant(
      prisma.staffProfile as ScopedFindFirstDelegate,
      context,
      {
        where: { id: input.assignedStaffId, isAssignable: true },
        select: { id: true },
      } as Parameters<typeof prisma.staffProfile.findFirst>[0],
    );

    if (!assignedStaff) {
      throw new Error("Assigned staff profile not found.");
    }
  }

  const updated = await prisma.inspectionBooking.update({
    where: { id: bookingId },
    data: {
      status: input.status,
      assignedStaffId: input.assignedStaffId ?? null,
      notes: input.notes ?? null,
      ...(input.scheduledFor ? { scheduledFor: new Date(input.scheduledFor) } : {}),
    },
    select: {
      id: true,
      userId: true,
      email: true,
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
      type: "INSPECTION_UPDATED",
      title: "Inspection updated",
      body: `Your inspection is now ${updated.status.toLowerCase().replaceAll("_", " ")}.`,
      metadata: {
        inspectionId: bookingId,
      } as Prisma.InputJsonValue,
    });
  }

  if (updated.assignedStaff?.user.id && updated.assignedStaffId !== booking.assignedStaffId) {
    await notifyManyUsers([updated.assignedStaff.user], {
      companyId: context.companyId,
      type: "INSPECTION_UPDATED",
      title: "Inspection assigned to you",
      body: "An inspection booking has been assigned to your queue.",
      metadata: {
        inspectionId: bookingId,
      } as Prisma.InputJsonValue,
      emailSubject: "New EstateOS inspection assignment",
      emailHtml: (recipient) =>
        `<p>Hi ${recipient},</p><p>An inspection booking has been assigned to you in EstateOS.</p>`,
    });
  }

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "InspectionBooking",
    entityId: bookingId,
    summary: `Updated inspection booking ${bookingId}`,
    payload: {
      previousStatus: booking.status,
      nextStatus: updated.status,
      assignedStaffId: updated.assignedStaffId,
    } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function getBuyerInspectionBookings(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return [];
  }

  return (await findManyForTenant(
    prisma.inspectionBooking as ScopedFindManyDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        scheduledFor: "desc",
      },
      select: {
        id: true,
        scheduledFor: true,
        status: true,
        property: {
          select: {
            title: true,
          },
        },
        assignedStaff: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    } as Parameters<typeof prisma.inspectionBooking.findMany>[0],
  )) as Array<{
    id: string;
    scheduledFor: Date;
    status: string;
    property: { title: string };
    assignedStaff: { user: { firstName: string | null; lastName: string | null } } | null;
  }>;
}
