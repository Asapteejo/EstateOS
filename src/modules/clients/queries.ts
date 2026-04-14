import { featureFlags } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant } from "@/lib/tenancy/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { buildWishlistTimeLabel, buildWishlistWhatsAppHref, getWishlistLifecycleState } from "@/modules/wishlist/service";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type Decimalish = { toNumber?: () => number } | number;

function decimalToNumber(value: Decimalish | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function displayName(input: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || input.email || "Client";
}

export type AdminClientListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  kycStatus: string;
  currentStage: string;
  wishlistCount: number;
  reservationCount: number;
  paymentCount: number;
  outstandingBalance: string;
  lastActivityAt: string;
  href: string;
};

export type AdminClientProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  occupation: string | null;
  kycStatus: string;
  assignedMarketer: string | null;
  summary: {
    wishlistCount: number;
    reservationCount: number;
    paymentCount: number;
    outstandingBalance: string;
    latestActivity: string;
  };
  wishlistItems: Array<{
    id: string;
    propertyTitle: string;
    propertySlug: string;
    savedAt: string;
    expiresAt: string | null;
    status: string;
    timeLabel: string;
    followUpStatus: string;
    followUpNote: string | null;
    assignedStaffId: string | null;
    assignedStaffName: string | null;
    whatsappHref: string | null;
  }>;
  inquiries: Array<{
    id: string;
    propertyTitle: string;
    status: string;
    createdAt: string;
    assignedStaffName: string;
  }>;
  inspections: Array<{
    id: string;
    propertyTitle: string;
    status: string;
    scheduledFor: string;
    assignedStaffName: string;
  }>;
  reservations: Array<{
    id: string;
    reference: string;
    propertyTitle: string;
    status: string;
    marketerName: string | null;
  }>;
  payments: Array<{
    id: string;
    reference: string;
    amount: string;
    status: string;
    method: string;
    receiptHref: string | null;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    type: string;
    href: string;
  }>;
  timeline: Array<{
    title: string;
    detail: string;
    time: string;
  }>;
  followUpStaffOptions: Array<{
    id: string;
    label: string;
  }>;
};

export async function getAdminClientList(context: TenantContext): Promise<AdminClientListItem[]> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  const clients = (await findManyForTenant(
    prisma.user as ScopedFindManyDelegate,
    context,
    {
      where: {
        roles: {
          some: {
            role: {
              name: "BUYER",
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        savedProperties: {
          where: {
            status: {
              in: ["ACTIVE", "EXPIRED"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            createdAt: true,
          },
        },
        reservations: {
          select: {
            id: true,
            createdAt: true,
            transaction: {
              select: {
                currentStage: true,
                outstandingBalance: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            createdAt: true,
          },
        },
        kycSubmissions: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
          select: {
            status: true,
          },
        },
      },
    } as Parameters<typeof prisma.user.findMany>[0],
  )) as Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    savedProperties: Array<{ id: string; createdAt: Date }>;
    reservations: Array<{ id: string; createdAt: Date; transaction: { currentStage: string; outstandingBalance: Decimalish } | null }>;
    payments: Array<{ id: string; createdAt: Date }>;
    kycSubmissions: Array<{ status: string }>;
  }>;

  return clients.map((client) => {
    const lastDates = [
      client.savedProperties[0]?.createdAt,
      client.reservations[0]?.createdAt,
      client.payments[0]?.createdAt,
    ].filter(Boolean) as Date[];

    const latestDate = lastDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();
    const outstandingBalance = client.reservations.reduce((sum, reservation) => {
      return sum + decimalToNumber(reservation.transaction?.outstandingBalance);
    }, 0);

    return {
      id: client.id,
      name: displayName(client),
      email: client.email,
      phone: client.phone,
      kycStatus: client.kycSubmissions[0]?.status ?? "NOT_SUBMITTED",
      currentStage: client.reservations[0]?.transaction?.currentStage ?? "No active deal",
      wishlistCount: client.savedProperties.length,
      reservationCount: client.reservations.length,
      paymentCount: client.payments.length,
      outstandingBalance: formatCurrency(outstandingBalance),
      lastActivityAt: formatDate(latestDate, "PPP p"),
      href: `/admin/clients/${client.id}`,
    };
  });
}

export async function getAdminClientProfile(
  context: TenantContext,
  clientId: string,
): Promise<AdminClientProfile | null> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  const client = (await findFirstForTenant(
    prisma.user as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: clientId,
        roles: {
          some: {
            role: {
              name: "BUYER",
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profile: {
          select: {
            city: true,
            state: true,
            occupation: true,
          },
        },
        kycSubmissions: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
          select: {
            status: true,
          },
        },
        savedProperties: {
          where: {
            status: {
              in: ["ACTIVE", "EXPIRED"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            status: true,
            followUpStatus: true,
            followUpNote: true,
            assignedStaffId: true,
            assignedStaff: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            property: {
              select: {
                title: true,
                slug: true,
              },
            },
          },
        },
        inquiries: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
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
                    email: true,
                  },
                },
              },
            },
          },
        },
        inspectionBookings: {
          orderBy: {
            scheduledFor: "desc",
          },
          select: {
            id: true,
            status: true,
            scheduledFor: true,
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
                    email: true,
                  },
                },
              },
            },
          },
        },
        reservations: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            reference: true,
            status: true,
            property: {
              select: {
                title: true,
              },
            },
            marketer: {
              select: {
                fullName: true,
              },
            },
            transaction: {
              select: {
                outstandingBalance: true,
                currentStage: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            providerReference: true,
            amount: true,
            status: true,
            method: true,
            receipt: {
              select: {
                id: true,
              },
            },
          },
        },
        documents: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 8,
          select: {
            id: true,
            fileName: true,
            documentType: true,
          },
        },
      },
    } as Parameters<typeof prisma.user.findFirst>[0],
  )) as {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    profile: { city: string | null; state: string | null; occupation: string | null } | null;
    kycSubmissions: Array<{ status: string }>;
    savedProperties: Array<{
      id: string;
      createdAt: Date;
      expiresAt: Date | null;
      status: "ACTIVE" | "EXPIRED" | "REMOVED";
      followUpStatus: string;
      followUpNote: string | null;
      assignedStaffId: string | null;
      assignedStaff: { firstName: string | null; lastName: string | null; email: string | null } | null;
      property: { title: string; slug: string };
    }>;
    inquiries: Array<{
      id: string;
      status: string;
      createdAt: Date;
      property: { title: string } | null;
      assignedStaff: { user: { firstName: string | null; lastName: string | null; email: string | null } } | null;
    }>;
    inspectionBookings: Array<{
      id: string;
      status: string;
      scheduledFor: Date;
      property: { title: string };
      assignedStaff: { user: { firstName: string | null; lastName: string | null; email: string | null } } | null;
    }>;
    reservations: Array<{
      id: string;
      reference: string;
      status: string;
      property: { title: string };
      marketer: { fullName: string } | null;
      transaction: { outstandingBalance: Decimalish; currentStage: string } | null;
    }>;
    payments: Array<{
      id: string;
      providerReference: string;
      amount: Decimalish;
      status: string;
      method: string;
      receipt: { id: string } | null;
    }>;
    documents: Array<{
      id: string;
      fileName: string;
      documentType: string;
    }>;
  } | null;

  if (!client) {
    return null;
  }

  const marketerName =
    client.reservations.find((item) => item.marketer)?.marketer?.fullName ??
    null;

  const latestDates = [
    client.savedProperties[0]?.createdAt,
    client.inquiries[0]?.createdAt,
    client.inspectionBookings[0]?.scheduledFor,
  ].filter(Boolean) as Date[];

  const followUpStaffOptions = await prisma.user.findMany({
    where: {
      companyId: context.companyId,
      isActive: true,
      roles: {
        some: {
          role: {
            name: {
              in: ["ADMIN", "STAFF", "FINANCE", "LEGAL"],
            },
          },
        },
      },
    },
    orderBy: {
      firstName: "asc",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  const timeline = [
    ...client.savedProperties.map((item) => ({
      title: "Wishlist activity",
      detail: `${item.property.title} saved to wishlist`,
      time: formatDate(item.createdAt, "PPP p"),
      createdAt: item.createdAt,
    })),
    ...client.inquiries.map((item) => ({
      title: "Inquiry submitted",
      detail: item.property?.title ?? "General inquiry",
      time: formatDate(item.createdAt, "PPP p"),
      createdAt: item.createdAt,
    })),
    ...client.inspectionBookings.map((item) => ({
      title: "Inspection booking",
      detail: `${item.property.title}  -  ${item.status.toLowerCase()}`,
      time: formatDate(item.scheduledFor, "PPP p"),
      createdAt: item.scheduledFor,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map(({ title, detail, time }) => ({ title, detail, time }));

  const outstandingBalance = client.reservations.reduce((sum, reservation) => {
    return sum + decimalToNumber(reservation.transaction?.outstandingBalance);
  }, 0);

  return {
    id: client.id,
    name: displayName(client),
    email: client.email,
    phone: client.phone,
    city: client.profile?.city ?? null,
    state: client.profile?.state ?? null,
    occupation: client.profile?.occupation ?? null,
    kycStatus: client.kycSubmissions[0]?.status ?? "NOT_SUBMITTED",
    assignedMarketer: marketerName,
    summary: {
      wishlistCount: client.savedProperties.length,
      reservationCount: client.reservations.length,
      paymentCount: client.payments.length,
      outstandingBalance: formatCurrency(outstandingBalance),
      latestActivity: formatDate(latestDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date(), "PPP p"),
    },
    wishlistItems: client.savedProperties.map((item) => {
      const lifecycleState = getWishlistLifecycleState(item);
      const assignedStaffName = item.assignedStaff
        ? displayName(item.assignedStaff)
        : null;

      return {
        id: item.id,
        propertyTitle: item.property.title,
        propertySlug: item.property.slug,
        savedAt: formatDate(item.createdAt, "PPP p"),
        expiresAt: item.expiresAt ? formatDate(item.expiresAt) : null,
        status: lifecycleState,
        timeLabel: buildWishlistTimeLabel({
          status: lifecycleState,
          expiresAt: item.expiresAt,
          createdAt: item.createdAt,
        }),
        followUpStatus: item.followUpStatus,
        followUpNote: item.followUpNote,
        assignedStaffId: item.assignedStaffId,
        assignedStaffName,
        whatsappHref: buildWishlistWhatsAppHref({
          phone: client.phone,
          clientName: displayName(client),
          propertyTitle: item.property.title,
        }),
      };
    }),
    inquiries: client.inquiries.map((item) => ({
      id: item.id,
      propertyTitle: item.property?.title ?? "General inquiry",
      status: item.status,
      createdAt: formatDate(item.createdAt, "PPP p"),
      assignedStaffName: item.assignedStaff?.user ? displayName(item.assignedStaff.user) : "Unassigned",
    })),
    inspections: client.inspectionBookings.map((item) => ({
      id: item.id,
      propertyTitle: item.property.title,
      status: item.status,
      scheduledFor: formatDate(item.scheduledFor, "PPP p"),
      assignedStaffName: item.assignedStaff?.user ? displayName(item.assignedStaff.user) : "Unassigned",
    })),
    reservations: client.reservations.map((item) => ({
      id: item.id,
      reference: item.reference,
      propertyTitle: item.property.title,
      status: item.status,
      marketerName: item.marketer?.fullName ?? null,
    })),
    payments: client.payments.map((item) => ({
      id: item.id,
      reference: item.providerReference,
      amount: formatCurrency(decimalToNumber(item.amount)),
      status: item.status,
      method: item.method,
      receiptHref: item.receipt ? `/api/receipts/${item.receipt.id}/download` : null,
    })),
    documents: client.documents.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      type: item.documentType,
      href: `/api/documents/${item.id}/download`,
    })),
    timeline,
    followUpStaffOptions: followUpStaffOptions.map((user) => ({
      id: user.id,
      label: displayName(user),
    })),
  };
}
