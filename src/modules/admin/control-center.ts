import { subDays, addDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { aggregateForTenant, countForTenant, findManyForTenant } from "@/lib/tenancy/db";
import { formatCurrency, formatDate } from "@/lib/utils";

type ScopedCountDelegate = { count: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedAggregateDelegate = { aggregate: (args?: unknown) => Promise<unknown> };

type Decimalish = { toNumber?: () => number } | number | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

export function deriveColdClientFlag(input: {
  latestActivityAt: Date | null;
  hasOpenIntent: boolean;
  now?: Date;
  staleDays?: number;
}) {
  const now = input.now ?? new Date();
  const staleDays = input.staleDays ?? 5;

  if (!input.hasOpenIntent || !input.latestActivityAt) {
    return false;
  }

  return input.latestActivityAt.getTime() <= subDays(now, staleDays).getTime();
}

export function buildDailyActionCards(input: {
  clientsNeedingFollowUp: number;
  expiringWishlists: number;
  upcomingInspections: number;
  overduePayments: number;
}) {
  return [
    {
      label: "Clients needing follow-up",
      value: input.clientsNeedingFollowUp,
      detail: "Wishlist, inquiry, or pending contact work",
      href: "/admin/clients",
    },
    {
      label: "Expiring wishlists",
      value: input.expiringWishlists,
      detail: "Next 72 hours",
      href: "/admin/clients",
    },
    {
      label: "Upcoming inspections",
      value: input.upcomingInspections,
      detail: "Next 72 hours",
      href: "/admin/bookings",
    },
    {
      label: "Overdue payments",
      value: input.overduePayments,
      detail: "Deals needing collection",
      href: "/admin/payments",
    },
  ];
}

export async function getAdminControlCenter(context: TenantContext) {
  const now = new Date();

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      todayActions: buildDailyActionCards({
        clientsNeedingFollowUp: 4,
        expiringWishlists: 3,
        upcomingInspections: 2,
        overduePayments: 2,
      }),
      pipelineSnapshot: [
        ["New inquiries", "8", "/admin/leads"],
        ["Inspections scheduled", "5", "/admin/bookings"],
        ["Reservations pending", "3", "/admin/transactions"],
        ["Payments in progress", "6", "/admin/payments"],
        ["Completed deals", "2", "/admin/transactions"],
      ],
      urgentAlerts: [
        ["Stale or unverified properties", "3", "/admin/listings"],
        ["Hidden listings", "1", "/admin/listings"],
        ["Failed payments", "0", "/admin/payments"],
        ["Clients going cold", "2", "/admin/clients"],
      ],
      quickActions: [
        { label: "Verify listings", href: "/admin/listings" },
        { label: "Contact clients", href: "/admin/clients" },
        { label: "Review payments", href: "/admin/payments" },
        { label: "Run reminders", href: "/admin/settings" },
      ],
      upcomingRows: [],
      urgentRows: [],
    };
  }

  const [expiringWishlists, upcomingInspections, overduePayments, failedPayments, propertyRisk, pipelineCounts, coldClientSignals] =
    await Promise.all([
      countForTenant(prisma.savedProperty as ScopedCountDelegate, context, {
        where: {
          status: "ACTIVE",
          expiresAt: {
            gte: now,
            lte: addDays(now, 3),
          },
        },
      } as Parameters<typeof prisma.savedProperty.count>[0]),
      countForTenant(prisma.inspectionBooking as ScopedCountDelegate, context, {
        where: {
          status: {
            in: ["CONFIRMED", "RESCHEDULED"],
          },
          scheduledFor: {
            gte: now,
            lte: addDays(now, 3),
          },
        },
      } as Parameters<typeof prisma.inspectionBooking.count>[0]),
      countForTenant(prisma.transaction as ScopedCountDelegate, context, {
        where: {
          paymentStatus: "OVERDUE",
        },
      } as Parameters<typeof prisma.transaction.count>[0]),
      countForTenant(prisma.payment as ScopedCountDelegate, context, {
        where: {
          status: "FAILED",
        },
      } as Parameters<typeof prisma.payment.count>[0]),
      findManyForTenant(prisma.property as ScopedFindManyDelegate, context, {
        select: {
          title: true,
          verificationStatus: true,
        },
      } as Parameters<typeof prisma.property.findMany>[0]),
      Promise.all([
        countForTenant(prisma.inquiry as ScopedCountDelegate, context, {
          where: {
            createdAt: {
              gte: subDays(now, 7),
            },
          },
        } as Parameters<typeof prisma.inquiry.count>[0]),
        countForTenant(prisma.inspectionBooking as ScopedCountDelegate, context, {
          where: {
            status: {
              in: ["REQUESTED", "CONFIRMED", "RESCHEDULED"],
            },
          },
        } as Parameters<typeof prisma.inspectionBooking.count>[0]),
        countForTenant(prisma.reservation as ScopedCountDelegate, context, {
          where: {
            status: {
              in: ["PENDING", "ACTIVE"],
            },
          },
        } as Parameters<typeof prisma.reservation.count>[0]),
        countForTenant(prisma.transaction as ScopedCountDelegate, context, {
          where: {
            paymentStatus: {
              in: ["PENDING", "PARTIAL", "OVERDUE"],
            },
          },
        } as Parameters<typeof prisma.transaction.count>[0]),
        countForTenant(prisma.transaction as ScopedCountDelegate, context, {
          where: {
            paymentStatus: "COMPLETED",
          },
        } as Parameters<typeof prisma.transaction.count>[0]),
      ]),
      findManyForTenant(prisma.user as ScopedFindManyDelegate, context, {
        where: {
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
          savedProperties: {
            where: {
              status: "ACTIVE",
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              createdAt: true,
              property: {
                select: {
                  title: true,
                },
              },
            },
          },
          inquiries: {
            where: {
              status: {
                in: ["NEW", "CONTACTED", "QUALIFIED", "INSPECTION_BOOKED"],
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              createdAt: true,
            },
          },
        },
      } as Parameters<typeof prisma.user.findMany>[0]),
    ]);

  const propertyRows = propertyRisk as Array<{ title: string; verificationStatus: string }>;
  const staleOrUnverified = propertyRows.filter((item) =>
    item.verificationStatus === "STALE" || item.verificationStatus === "UNVERIFIED",
  ).length;
  const hiddenListings = propertyRows.filter((item) => item.verificationStatus === "HIDDEN").length;

  const coldClients = (coldClientSignals as Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    savedProperties: Array<{ createdAt: Date; property: { title: string } }>;
    inquiries: Array<{ createdAt: Date }>;
  }>).filter((client) =>
    deriveColdClientFlag({
      latestActivityAt:
        [client.savedProperties[0]?.createdAt, client.inquiries[0]?.createdAt]
          .filter(Boolean)
          .sort((left, right) => right!.getTime() - left!.getTime())[0] ?? null,
      hasOpenIntent: client.savedProperties.length > 0 || client.inquiries.length > 0,
      now,
    }),
  );

  const totalClientsNeedingFollowUp =
    coldClients.length + Number(expiringWishlists) + Number(upcomingInspections);

  const upcomingInspectionRows = (await findManyForTenant(
    prisma.inspectionBooking as ScopedFindManyDelegate,
    context,
    {
      where: {
        status: {
          in: ["CONFIRMED", "RESCHEDULED"],
        },
        scheduledFor: {
          gte: now,
          lte: addDays(now, 3),
        },
      },
      orderBy: {
        scheduledFor: "asc",
      },
      take: 5,
      select: {
        fullName: true,
        scheduledFor: true,
        property: {
          select: {
            title: true,
          },
        },
      },
    } as Parameters<typeof prisma.inspectionBooking.findMany>[0],
  )) as Array<{ fullName: string; scheduledFor: Date; property: { title: string } }>;

  const overduePaymentRows = (await findManyForTenant(
    prisma.transaction as ScopedFindManyDelegate,
    context,
    {
      where: {
        paymentStatus: "OVERDUE",
      },
      orderBy: {
        nextPaymentDueAt: "asc",
      },
      take: 5,
      select: {
        reservation: {
          select: {
            reference: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        outstandingBalance: true,
      },
    } as Parameters<typeof prisma.transaction.findMany>[0],
  )) as Array<{
    reservation: { reference: string } | null;
    user: { firstName: string | null; lastName: string | null };
    outstandingBalance: Decimalish;
  }>;

  return {
    todayActions: buildDailyActionCards({
      clientsNeedingFollowUp: totalClientsNeedingFollowUp,
      expiringWishlists: Number(expiringWishlists),
      upcomingInspections: Number(upcomingInspections),
      overduePayments: Number(overduePayments),
    }),
    pipelineSnapshot: [
      ["New inquiries", String(pipelineCounts[0] as number), "/admin/leads"],
      ["Inspections scheduled", String(pipelineCounts[1] as number), "/admin/bookings"],
      ["Reservations pending", String(pipelineCounts[2] as number), "/admin/transactions"],
      ["Payments in progress", String(pipelineCounts[3] as number), "/admin/payments"],
      ["Completed deals", String(pipelineCounts[4] as number), "/admin/transactions"],
    ],
    urgentAlerts: [
      ["Stale or unverified properties", String(staleOrUnverified), "/admin/listings"],
      ["Hidden listings", String(hiddenListings), "/admin/listings"],
      ["Failed payments", String(failedPayments as number), "/admin/payments"],
      ["Clients going cold", String(coldClients.length), "/admin/clients"],
    ],
    quickActions: [
      { label: "Verify listings", href: "/admin/listings" },
      { label: "Contact clients", href: "/admin/clients" },
      { label: "Review payments", href: "/admin/payments" },
      { label: "Update settings", href: "/admin/settings" },
    ],
    upcomingRows: upcomingInspectionRows.map((item) => [
      item.fullName,
      item.property.title,
      formatDate(item.scheduledFor, "PPP p"),
    ]),
    urgentRows: overduePaymentRows.map((item) => [
      item.reservation?.reference ?? "Transaction",
      `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim() || "Buyer",
      formatCurrency(decimalToNumber(item.outstandingBalance)),
    ]),
  };
}

export async function getAdminPaymentMonitoring(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      summary: [
        ["Outstanding balances", "NGN 124,000,000"],
        ["Overdue deals", "2"],
        ["Partially paid", "4"],
        ["Completed deals", "3"],
      ],
      rows: [],
      paymentRequests: [],
      clientOptions: [],
    };
  }

  const [totals, rows, paymentRequests, clientOptions] = await Promise.all([
    Promise.all([
      aggregateForTenant(prisma.transaction as ScopedAggregateDelegate, context, {
        where: {
          paymentStatus: {
            in: ["PENDING", "PARTIAL", "OVERDUE"],
          },
        },
        _sum: {
          outstandingBalance: true,
        },
      } as Parameters<typeof prisma.transaction.aggregate>[0]),
      countForTenant(prisma.transaction as ScopedCountDelegate, context, {
        where: {
          paymentStatus: "OVERDUE",
        },
      } as Parameters<typeof prisma.transaction.count>[0]),
      countForTenant(prisma.transaction as ScopedCountDelegate, context, {
        where: {
          paymentStatus: "PARTIAL",
        },
      } as Parameters<typeof prisma.transaction.count>[0]),
      countForTenant(prisma.transaction as ScopedCountDelegate, context, {
        where: {
          paymentStatus: "COMPLETED",
        },
      } as Parameters<typeof prisma.transaction.count>[0]),
    ]),
    findManyForTenant(prisma.transaction as ScopedFindManyDelegate, context, {
      orderBy: [
        { paymentStatus: "desc" },
        { updatedAt: "desc" },
      ],
      take: 20,
      select: {
        id: true,
        paymentStatus: true,
        currentStage: true,
        nextPaymentDueAt: true,
        outstandingBalance: true,
        reservation: {
          select: {
            reference: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            receipt: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    } as Parameters<typeof prisma.transaction.findMany>[0]),
    findManyForTenant(prisma.paymentRequest as ScopedFindManyDelegate, context, {
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
      select: {
        id: true,
        title: true,
        amount: true,
        currency: true,
        status: true,
        collectionMethod: true,
        dueAt: true,
        checkoutUrl: true,
        providerReference: true,
        transferBankName: true,
        transferAccountNumber: true,
        transferAccountName: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    } as Parameters<typeof prisma.paymentRequest.findMany>[0]),
    findManyForTenant(prisma.transaction as ScopedFindManyDelegate, context, {
      where: {
        paymentStatus: {
          in: ["PENDING", "PARTIAL", "OVERDUE"],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 30,
      select: {
        id: true,
        reservationId: true,
        outstandingBalance: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    } as Parameters<typeof prisma.transaction.findMany>[0]),
  ]);

  return {
    summary: [
      [
        "Outstanding balances",
        formatCurrency(decimalToNumber((totals[0] as { _sum: { outstandingBalance?: Decimalish } })._sum.outstandingBalance)),
      ],
      ["Overdue deals", String(totals[1] as number)],
      ["Partially paid", String(totals[2] as number)],
      ["Completed deals", String(totals[3] as number)],
    ],
    rows: (rows as Array<{
      id: string;
      paymentStatus: string;
      currentStage: string;
      nextPaymentDueAt: Date | null;
      outstandingBalance: Decimalish;
      reservation: { reference: string } | null;
      user: { firstName: string | null; lastName: string | null };
      payments: Array<{ receipt: { id: string } | null }>;
    }>).map((row) => ({
      id: row.id,
      reference: row.reservation?.reference ?? row.id,
      buyer: `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || "Buyer",
      paymentStatus: row.paymentStatus,
      stage: row.currentStage,
      outstandingBalance: formatCurrency(decimalToNumber(row.outstandingBalance)),
      nextDueAt: row.nextPaymentDueAt ? formatDate(row.nextPaymentDueAt, "PPP") : "Not scheduled",
      receiptId: row.payments[0]?.receipt?.id ?? null,
    })),
    paymentRequests: (paymentRequests as Array<{
      id: string;
      title: string;
      amount: Decimalish;
      currency: string;
      status: string;
      collectionMethod: string;
      dueAt: Date | null;
      checkoutUrl: string | null;
      providerReference: string | null;
      transferBankName: string | null;
      transferAccountNumber: string | null;
      transferAccountName: string | null;
      user: { firstName: string | null; lastName: string | null; email: string | null };
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      purpose: row.title,
      amount: `${row.currency} ${formatCurrency(decimalToNumber(row.amount)).replace(/^NGN\s/, "")}`,
      status: row.status,
      collectionMethod: row.collectionMethod.replaceAll("_", " "),
      dueAt: row.dueAt ? formatDate(row.dueAt, "PPP") : null,
      buyer: `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || row.user.email || "Client",
      reference: row.providerReference,
      transferSummary:
        row.transferAccountNumber
          ? `${row.transferBankName ?? "Bank"} / ${row.transferAccountNumber}${row.transferAccountName ? ` (${row.transferAccountName})` : ""}`
          : null,
      checkoutUrl: row.checkoutUrl,
    })),
    clientOptions: (clientOptions as Array<{
      id: string;
      reservationId: string;
      outstandingBalance: Decimalish;
      user: { id: string; firstName: string | null; lastName: string | null };
    }>).map((row) => ({
      id: row.user.id,
      label: `${`${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || "Client"} · ${row.id}`,
      transactionId: row.id,
      reservationId: row.reservationId,
      outstandingBalance: formatCurrency(decimalToNumber(row.outstandingBalance)),
    })),
  };
}
