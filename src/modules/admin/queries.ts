import { featureFlags } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { aggregateForTenant, countForTenant, findManyForTenant } from "@/lib/tenancy/db";
import type { TenantContext } from "@/lib/tenancy/context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { properties as demoProperties } from "@/modules/properties/demo-data";
import { adminMetrics, adminTables } from "@/modules/admin/demo-data";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedCountDelegate = { count: (args?: unknown) => Promise<unknown> };
type ScopedAggregateDelegate = { aggregate: (args?: unknown) => Promise<unknown> };
type TransactionAggregateResult = {
  _sum: {
    totalValue: { toNumber?: () => number } | null;
  };
};

export function buildAdminAuditLogWhere() {
  return {};
}

export function buildAdminNotificationWhere() {
  return {
    channel: {
      in: ["IN_APP", "EMAIL"],
    },
  };
}

export type AdminNotificationListItem = {
  id: string;
  title: string;
  channel: string;
  recipient: string;
  state: "Read" | "Unread";
  created: string;
};

export async function getAdminPropertiesTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return demoProperties.map((property) => [
      property.title,
      property.type,
      property.status,
      property.city,
      String(property.inquiryCount),
    ]);
  }

  const properties = (await findManyForTenant(
    prisma.property as ScopedFindManyDelegate,
    context,
    {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        propertyType: true,
        status: true,
        location: {
          select: {
            city: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.property.findMany>[0],
  )) as Array<{
    id: string;
    title: string;
    propertyType: string;
    status: string;
    location: { city: string; companyId: string } | null;
  }>;

  const inquiryCounts = await Promise.all(
    properties.map(async (property) => {
      const count = (await countForTenant(
        prisma.inquiry as ScopedCountDelegate,
        context,
        {
          where: { propertyId: property.id },
        } as Parameters<typeof prisma.inquiry.count>[0],
      )) as number;

      return [property.id, count] as const;
    }),
  );

  const countMap = new Map(inquiryCounts);

  return properties.map((property) => [
    property.title,
    property.propertyType,
    property.status,
    property.location?.companyId === context.companyId ? property.location.city : "Unknown",
    String(countMap.get(property.id) ?? 0),
  ]);
}

export async function getAdminInquiriesTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return adminTables.inquiries.map((item) => [
      item.lead,
      item.property,
      item.source,
      item.status,
      item.owner,
    ]);
  }

  const inquiries = (await findManyForTenant(
    prisma.inquiry as ScopedFindManyDelegate,
    context,
    {
      orderBy: { createdAt: "desc" },
      select: {
        fullName: true,
        source: true,
        status: true,
        property: {
          select: {
            title: true,
            companyId: true,
          },
        },
        assignedStaff: {
          select: {
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
    fullName: string;
    source: string;
    status: string;
    property: { title: string; companyId: string } | null;
    assignedStaff: {
      user: {
        firstName: string | null;
        lastName: string | null;
        companyId: string | null;
      };
    } | null;
  }>;

  return inquiries.map((inquiry) => [
    inquiry.fullName,
    inquiry.property?.companyId === context.companyId ? inquiry.property.title : "Unlinked",
    inquiry.source,
    inquiry.status,
    inquiry.assignedStaff?.user.companyId === context.companyId
      ? `${inquiry.assignedStaff.user.firstName ?? ""} ${inquiry.assignedStaff.user.lastName ?? ""}`.trim() || "Unassigned"
      : "Unassigned",
  ]);
}

export async function getAdminBookingsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return adminTables.bookings.map((item) => [
      item.client,
      item.property,
      item.date,
      item.status,
    ]);
  }

  const bookings = (await findManyForTenant(
    prisma.inspectionBooking as ScopedFindManyDelegate,
    context,
    {
      orderBy: {
        scheduledFor: "desc",
      },
      select: {
        fullName: true,
        scheduledFor: true,
        status: true,
        property: {
          select: {
            title: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.inspectionBooking.findMany>[0],
  )) as Array<{
    fullName: string;
    scheduledFor: Date;
    status: string;
    property: { title: string; companyId: string } | null;
  }>;

  return bookings.map((booking) => [
    booking.fullName,
    booking.property?.companyId === context.companyId ? booking.property.title : "Unlinked",
    formatDate(booking.scheduledFor),
    booking.status,
  ]);
}

export async function getAdminClientsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return adminTables.clients.map((item) => [
      item.name,
      item.stage,
      item.assigned,
      item.kyc,
    ]);
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
        firstName: true,
        lastName: true,
        companyId: true,
        reservations: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            transaction: {
              select: {
                currentStage: true,
              },
            },
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
        inquiries: {
          where: {
            assignedStaffId: {
              not: null,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            assignedStaff: {
              select: {
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
        },
      },
    } as Parameters<typeof prisma.user.findMany>[0],
  )) as Array<{
    firstName: string | null;
    lastName: string | null;
    companyId: string | null;
    reservations: Array<{
      transaction: {
        currentStage: string;
      } | null;
    }>;
    kycSubmissions: Array<{ status: string }>;
    inquiries: Array<{
      assignedStaff: {
        user: {
          firstName: string | null;
          lastName: string | null;
          companyId: string | null;
        };
      } | null;
    }>;
  }>;

  return clients
    .filter((client) => client.companyId === context.companyId)
    .map((client) => {
      const assignedUser = client.inquiries[0]?.assignedStaff?.user;

      return [
        `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Unnamed client",
        client.reservations[0]?.transaction?.currentStage ?? "No active transaction",
        assignedUser?.companyId === context.companyId
          ? `${assignedUser.firstName ?? ""} ${assignedUser.lastName ?? ""}`.trim() || "Unassigned"
          : "Unassigned",
        client.kycSubmissions[0]?.status ?? "Pending",
      ];
    });
}

export async function getAdminPaymentsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return adminTables.payments.map((item) => [
      item.ref,
      item.buyer,
      item.amount,
      item.status,
      item.method,
    ]);
  }

  const payments = (await findManyForTenant(
    prisma.payment as ScopedFindManyDelegate,
    context,
    {
      orderBy: { createdAt: "desc" },
      select: {
        providerReference: true,
        amount: true,
        status: true,
        method: true,
        marketer: {
          select: {
            fullName: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.payment.findMany>[0],
  )) as Array<{
    providerReference: string;
    amount: { toNumber: () => number };
    status: string;
    method: string;
    marketer: { fullName: string } | null;
    user: {
      firstName: string | null;
      lastName: string | null;
      companyId: string | null;
    } | null;
  }>;

  return payments.map((payment) => [
    payment.providerReference,
    payment.user?.companyId === context.companyId
      ? `${payment.user.firstName ?? ""} ${payment.user.lastName ?? ""}`.trim() || "Unknown"
      : "Unknown",
    payment.marketer?.fullName ?? "Unassigned",
    formatCurrency(payment.amount.toNumber()),
    payment.status,
    payment.method,
  ]);
}

export async function getAdminAuditLogsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return adminTables.audit.map((item) => [
      item.actor,
      item.action,
      item.target,
      item.time,
    ]);
  }

  const auditLogs = (await findManyForTenant(
    prisma.auditLog as ScopedFindManyDelegate,
    context,
    {
      where: buildAdminAuditLogWhere(),
      orderBy: {
        createdAt: "desc",
      },
      select: {
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actorUser: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
      },
      take: 50,
    } as Parameters<typeof prisma.auditLog.findMany>[0],
  )) as Array<{
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
    actorUser: {
      firstName: string | null;
      lastName: string | null;
      companyId: string | null;
    } | null;
  }>;

  return auditLogs.map((log) => [
    log.actorUser?.companyId === context.companyId
      ? `${log.actorUser.firstName ?? ""} ${log.actorUser.lastName ?? ""}`.trim() || "System"
      : "System",
    log.action,
    `${log.entityType}:${log.entityId}`,
    formatDate(log.createdAt, "PPP p"),
  ]);
}

export async function getAdminNotificationsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [
      ["Payment confirmed", "IN_APP", "Ada Okafor", "Unread", "2026-03-28 14:20"],
    ];
  }

  const notifications = (await findManyForTenant(
    prisma.notification as ScopedFindManyDelegate,
    context,
    {
      where: buildAdminNotificationWhere(),
      orderBy: {
        createdAt: "desc",
      },
      select: {
        title: true,
        channel: true,
        readAt: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
      },
      take: 50,
    } as Parameters<typeof prisma.notification.findMany>[0],
  )) as Array<{
    title: string;
    channel: string;
    readAt: Date | null;
    createdAt: Date;
    user: {
      firstName: string | null;
      lastName: string | null;
      companyId: string | null;
    };
  }>;

  return notifications.map((notification) => [
    notification.title,
    notification.channel,
    notification.user.companyId === context.companyId
      ? `${notification.user.firstName ?? ""} ${notification.user.lastName ?? ""}`.trim() || "Unknown"
      : "Unknown",
    notification.readAt ? "Read" : "Unread",
    formatDate(notification.createdAt, "PPP p"),
  ]);
}

export async function getAdminNotificationsList(
  context: TenantContext,
): Promise<AdminNotificationListItem[]> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [
      {
        id: "demo-notification-1",
        title: "Payment confirmed",
        channel: "IN_APP",
        recipient: "Ada Okafor",
        state: "Unread",
        created: "2026-03-28 14:20",
      },
    ];
  }

  const notifications = (await findManyForTenant(
    prisma.notification as ScopedFindManyDelegate,
    context,
    {
      where: buildAdminNotificationWhere(),
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        channel: true,
        readAt: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
      },
      take: 50,
    } as Parameters<typeof prisma.notification.findMany>[0],
  )) as Array<{
    id: string;
    title: string;
    channel: string;
    readAt: Date | null;
    createdAt: Date;
    user: {
      firstName: string | null;
      lastName: string | null;
      companyId: string | null;
    };
  }>;

  return notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    channel: notification.channel,
    recipient:
      notification.user.companyId === context.companyId
        ? `${notification.user.firstName ?? ""} ${notification.user.lastName ?? ""}`.trim() ||
          "Unknown"
        : "Unknown",
    state: notification.readAt ? "Read" : "Unread",
    created: formatDate(notification.createdAt, "PPP p"),
  }));
}

export async function getAdminTransactionsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return adminTables.transactions.map((item) => [
      item.ref,
      item.property,
      item.buyer,
      item.status,
      item.balance,
    ]);
  }

  const transactions = (await findManyForTenant(
    prisma.transaction as ScopedFindManyDelegate,
    context,
    {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        currentStage: true,
        outstandingBalance: true,
        marketer: {
          select: {
            fullName: true,
          },
        },
        reservation: {
          select: {
            reference: true,
          },
        },
        property: {
          select: {
            title: true,
            companyId: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.transaction.findMany>[0],
  )) as Array<{
    id: string;
    currentStage: string;
    outstandingBalance: { toNumber: () => number };
    marketer: { fullName: string } | null;
    reservation: { reference: string } | null;
    property: { title: string; companyId: string } | null;
    user: { firstName: string | null; lastName: string | null; companyId: string | null } | null;
  }>;

  return transactions.map((transaction) => [
    transaction.reservation?.reference ?? transaction.id,
    transaction.property?.companyId === context.companyId ? transaction.property.title : "Unlinked",
    transaction.user?.companyId === context.companyId
      ? `${transaction.user.firstName ?? ""} ${transaction.user.lastName ?? ""}`.trim() || "Unknown"
      : "Unknown",
    transaction.marketer?.fullName ?? "Unassigned",
    transaction.currentStage,
    formatCurrency(transaction.outstandingBalance.toNumber()),
  ]);
}

export async function getAdminDocumentsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return adminTables.documents.map((item) => [
      item.file,
      item.owner,
      item.type,
      item.status,
    ]);
  }

  const documents = (await findManyForTenant(
    prisma.document as ScopedFindManyDelegate,
    context,
    {
      orderBy: { updatedAt: "desc" },
      select: {
        fileName: true,
        documentType: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
        transaction: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                companyId: true,
              },
            },
          },
        },
        kycSubmissions: {
          select: {
            status: true,
          },
          take: 1,
          orderBy: {
            updatedAt: "desc",
          },
        },
      },
    } as Parameters<typeof prisma.document.findMany>[0],
  )) as Array<{
    fileName: string;
    documentType: string;
    user: { firstName: string | null; lastName: string | null; companyId: string | null } | null;
    transaction: {
      user: { firstName: string | null; lastName: string | null; companyId: string | null } | null;
    } | null;
    kycSubmissions: Array<{ status: string }>;
  }>;

  return documents.map((document) => {
    const directOwner =
      document.user?.companyId === context.companyId
        ? `${document.user.firstName ?? ""} ${document.user.lastName ?? ""}`.trim()
        : "";
    const transactionOwner =
      document.transaction?.user?.companyId === context.companyId
        ? `${document.transaction.user.firstName ?? ""} ${document.transaction.user.lastName ?? ""}`.trim()
        : "";

    return [
      document.fileName,
      directOwner || transactionOwner || "Unassigned",
      document.documentType,
      document.kycSubmissions[0]?.status ?? "Pending",
    ];
  });
}

export async function getAdminDashboardSummary(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      metrics: adminMetrics,
      topDeals: adminTables.transactions.map((item) => [
        item.ref,
        item.property,
        item.buyer,
        item.status,
        item.balance,
      ]),
      topListings: demoProperties.slice(0, 3).map((property) => [
        property.title,
        String(property.inquiryCount),
      ]),
      topStaff: adminTables.inquiries.slice(0, 2).map((item) => [item.owner, item.status]),
    };
  }

  const [
    totalInquiries,
    reservationsMade,
    activeDeals,
    overduePayments,
    totalSalesValueRaw,
    transactions,
    properties,
    inquiryAssignments,
  ] = await Promise.all([
    countForTenant(prisma.inquiry as ScopedCountDelegate, context, {
      where: {},
    } as Parameters<typeof prisma.inquiry.count>[0]),
    countForTenant(prisma.reservation as ScopedCountDelegate, context, {
      where: {},
    } as Parameters<typeof prisma.reservation.count>[0]),
    countForTenant(prisma.transaction as ScopedCountDelegate, context, {
      where: {
        currentStage: {
          notIn: ["FINAL_PAYMENT_COMPLETED", "HANDOVER_COMPLETED"],
        },
      },
    } as Parameters<typeof prisma.transaction.count>[0]),
    countForTenant(prisma.payment as ScopedCountDelegate, context, {
      where: {
        status: "OVERDUE",
      },
    } as Parameters<typeof prisma.payment.count>[0]),
    aggregateForTenant(prisma.transaction as ScopedAggregateDelegate, context, {
      _sum: {
        totalValue: true,
      },
    } as Parameters<typeof prisma.transaction.aggregate>[0]),
    findManyForTenant(prisma.transaction as ScopedFindManyDelegate, context, {
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        currentStage: true,
        outstandingBalance: true,
        reservation: { select: { reference: true } },
        property: { select: { title: true, companyId: true } },
        user: { select: { firstName: true, lastName: true, companyId: true } },
      },
    } as Parameters<typeof prisma.transaction.findMany>[0]),
    findManyForTenant(prisma.property as ScopedFindManyDelegate, context, {
      select: {
        id: true,
        title: true,
      },
    } as Parameters<typeof prisma.property.findMany>[0]),
    findManyForTenant(prisma.inquiry as ScopedFindManyDelegate, context, {
      where: {
        assignedStaffId: {
          not: null,
        },
      },
      select: {
        assignedStaffId: true,
        assignedStaff: {
          select: {
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
    } as Parameters<typeof prisma.inquiry.findMany>[0]),
  ]);

  const propertyRows = properties as Array<{ id: string; title: string }>;
  const topListingsCounts = await Promise.all(
    propertyRows.map(async (property) => {
      const count = (await countForTenant(prisma.inquiry as ScopedCountDelegate, context, {
        where: {
          propertyId: property.id,
        },
      } as Parameters<typeof prisma.inquiry.count>[0])) as number;

      return {
        title: property.title,
        inquiries: count,
      };
    }),
  );

  const topListings = topListingsCounts
    .sort((left, right) => right.inquiries - left.inquiries)
    .slice(0, 3)
    .map((item) => [item.title, String(item.inquiries)]);

  const staffCounts = new Map<string, number>();
  for (const inquiry of inquiryAssignments as Array<{
    assignedStaffId: string | null;
    assignedStaff: {
      user: {
        firstName: string | null;
        lastName: string | null;
        companyId: string | null;
      };
    } | null;
  }>) {
    if (!inquiry.assignedStaffId || inquiry.assignedStaff?.user.companyId !== context.companyId) {
      continue;
    }

    const name =
      `${inquiry.assignedStaff.user.firstName ?? ""} ${inquiry.assignedStaff.user.lastName ?? ""}`.trim() ||
      "Unassigned";
    staffCounts.set(name, (staffCounts.get(name) ?? 0) + 1);
  }

  const topStaff = [...staffCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, count]) => [name, String(count)]);

  const metrics = [
    { label: "Total inquiries", value: String(totalInquiries as number), delta: "Tenant-scoped" },
    { label: "Reservations made", value: String(reservationsMade as number), delta: "Tenant-scoped" },
    { label: "Active deals", value: String(activeDeals as number), delta: "Tenant-scoped" },
    { label: "Overdue payments", value: String(overduePayments as number), delta: "Tenant-scoped" },
    {
      label: "Total sales value",
      value: formatCurrency(
        (totalSalesValueRaw as TransactionAggregateResult)._sum.totalValue?.toNumber?.() ?? 0,
      ),
      delta: "Tenant-scoped",
    },
    { label: "Top listings", value: topListings[0]?.[0] ?? "None", delta: "Tenant-scoped" },
  ];

  const topDeals = (transactions as Array<{
    id: string;
    currentStage: string;
    outstandingBalance: { toNumber: () => number };
    reservation: { reference: string } | null;
    property: { title: string; companyId: string } | null;
    user: { firstName: string | null; lastName: string | null; companyId: string | null } | null;
  }>).map((transaction) => [
    transaction.reservation?.reference ?? transaction.id,
    transaction.property?.companyId === context.companyId ? transaction.property.title : "Unlinked",
    transaction.user?.companyId === context.companyId
      ? `${transaction.user.firstName ?? ""} ${transaction.user.lastName ?? ""}`.trim() || "Unknown"
      : "Unknown",
    transaction.currentStage,
    formatCurrency(transaction.outstandingBalance.toNumber()),
  ]);

  return {
    metrics,
    topDeals,
    topListings,
    topStaff,
  };
}

export async function getAdminAnalyticsDetail(context: TenantContext) {
  const summary = await getAdminDashboardSummary(context);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      cards: [
        ["Lead conversion", "12.5%"],
        ["Payment success rate", "88%"],
        ["Avg. outstanding balance", "NGN 24,500,000"],
      ],
      topListings: summary.topListings,
      topStaff: summary.topStaff,
    };
  }

  const [totalInquiries, reservationsMade, successfulPayments, totalPayments, averageOutstanding] =
    await Promise.all([
      countForTenant(prisma.inquiry as ScopedCountDelegate, context, {
        where: {},
      } as Parameters<typeof prisma.inquiry.count>[0]),
      countForTenant(prisma.reservation as ScopedCountDelegate, context, {
        where: {},
      } as Parameters<typeof prisma.reservation.count>[0]),
      countForTenant(prisma.payment as ScopedCountDelegate, context, {
        where: {
          status: "SUCCESS",
        },
      } as Parameters<typeof prisma.payment.count>[0]),
      countForTenant(prisma.payment as ScopedCountDelegate, context, {
        where: {},
      } as Parameters<typeof prisma.payment.count>[0]),
      aggregateForTenant(prisma.transaction as ScopedAggregateDelegate, context, {
        _avg: {
          outstandingBalance: true,
        },
      } as Parameters<typeof prisma.transaction.aggregate>[0]),
    ]);

  const leadConversion =
    Number(totalInquiries) > 0
      ? `${((Number(reservationsMade) / Number(totalInquiries)) * 100).toFixed(1)}%`
      : "0.0%";
  const paymentSuccessRate =
    Number(totalPayments) > 0
      ? `${((Number(successfulPayments) / Number(totalPayments)) * 100).toFixed(1)}%`
      : "0.0%";
  const avgOutstandingValue =
    (averageOutstanding as {
      _avg: { outstandingBalance: { toNumber?: () => number } | null };
    })._avg.outstandingBalance?.toNumber?.() ?? 0;

  return {
    cards: [
      ["Lead conversion", leadConversion],
      ["Payment success rate", paymentSuccessRate],
      ["Avg. outstanding balance", formatCurrency(avgOutstandingValue)],
    ],
    topListings: summary.topListings,
    topStaff: summary.topStaff,
  };
}
