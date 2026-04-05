import { featureFlags } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { findManyForTenant, findFirstForTenant } from "@/lib/tenancy/db";
import type { TenantContext } from "@/lib/tenancy/context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { properties as demoProperties } from "@/modules/properties/demo-data";
import { buyerNotifications, buyerOverview, buyerTimeline } from "@/modules/portal/demo-data";
import { isBuyerOwnedDocumentRecord, isBuyerOwnedTransactionRecord } from "@/modules/portal/access";
import { buildBuyerPaymentProgress, resolveBuyerPaymentMarketer } from "@/modules/portal/payments";
import { buildTransactionInstallmentSchedule, summarizeTransactionPayment } from "@/modules/payments/progress";
import { buildPropertyVerificationPresentation } from "@/modules/properties/verification";
import type { PropertySummary } from "@/types/domain";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export async function getBuyerReservationsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return [["RSV-2026-00018", "Eko Atrium Residences", "ACTIVE", "No expiry"]];
  }

  const reservations = (await findManyForTenant(
    prisma.reservation as ScopedFindManyDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        reference: true,
        status: true,
        reservedUntil: true,
        property: {
          select: {
            title: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.reservation.findMany>[0],
  )) as Array<{
    reference: string;
    status: string;
    reservedUntil: Date | null;
    property: { title: string; companyId: string } | null;
  }>;

  return reservations.map((reservation) => [
    reservation.reference,
    reservation.property?.companyId === context.companyId ? reservation.property.title : "Unlinked",
    reservation.status,
    reservation.reservedUntil ? formatDate(reservation.reservedUntil) : "No expiry",
  ]);
}

export async function getBuyerPaymentsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return [["PAY-11082", "NGN 12,500,000", "SUCCESS", "PAYSTACK"]];
  }

  const payments = (await findManyForTenant(
    prisma.payment as ScopedFindManyDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        providerReference: true,
        amount: true,
        status: true,
        method: true,
        transaction: {
          select: {
            userId: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.payment.findMany>[0],
  )) as Array<{
    providerReference: string;
    amount: { toNumber?: () => number } | number;
    status: string;
    method: string;
    transaction: { userId: string; companyId: string } | null;
  }>;

  return payments
    .filter((payment) =>
      !payment.transaction ||
      isBuyerOwnedTransactionRecord({
        viewerCompanyId: context.companyId,
        viewerUserId: context.userId,
        recordCompanyId: payment.transaction.companyId,
        recordUserId: payment.transaction.userId,
      }),
    )
    .map((payment) => [
      payment.providerReference,
      formatCurrency(
        typeof payment.amount === "number"
          ? payment.amount
          : payment.amount.toNumber?.() ?? Number(payment.amount),
      ),
      payment.status,
      payment.method,
    ]);
}

export async function getBuyerPaymentExperience(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      progress: buildBuyerPaymentProgress({
        totalPayableAmount: 185000000,
        amountPaidSoFar: 160500000,
        installmentSchedule: [
          { title: "Reservation fee", amount: 12500000, status: "paid" as const, dueDate: "Mar 21, 2026" },
          { title: "Second tranche", amount: 48000000, status: "paid" as const, dueDate: "Apr 18, 2026" },
          { title: "Final settlement", amount: 124500000, status: "due" as const, dueDate: "May 20, 2026" },
        ],
      }),
      paymentStatus: "PARTIAL" as const,
      nextDueDate: "May 20, 2026",
      selectedMarketer: {
        fullName: "Tobi Adewale",
        title: "Senior marketer",
        slug: "tobi-adewale",
        avatarUrl: null,
      },
      selectedPaymentPlan: "24-month plan",
      receipts: [
        {
          id: "demo-receipt",
          receiptNumber: "RCT-PAY-11082",
          amount: "NGN 12,500,000",
          issuedAt: "2026-03-21",
          downloadHref: "/api/receipts/demo-receipt/download",
        },
      ],
      payments: [
        {
          reference: "PAY-11082",
          amount: "NGN 12,500,000",
          status: "SUCCESS",
          method: "PAYSTACK",
          receiptHref: "/api/receipts/demo-receipt/download",
        },
      ],
      paymentRequests: [
        {
          id: "demo-request",
          title: "Balance payment request",
          amount: "NGN 124,500,000",
          status: "AWAITING_PAYMENT",
          collectionMethod: "BANK_TRANSFER_TEMP_ACCOUNT",
          dueAt: "2026-05-20",
          expiresAt: null,
          reference: "acme-realty__REQ-DEMO",
          checkoutUrl: "#",
          transferSummary: "Complete the transfer from the secure payment link provided by Acme Realty.",
          notes: null,
        },
      ],
    };
  }

  const transaction = (await findFirstForTenant(
    prisma.transaction as ScopedFindFirstDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        totalValue: true,
        outstandingBalance: true,
        marketer: {
          select: {
            fullName: true,
            title: true,
            slug: true,
            avatarUrl: true,
          },
        },
        reservation: {
          select: {
            createdAt: true,
            marketer: {
              select: {
                fullName: true,
                title: true,
                slug: true,
                avatarUrl: true,
              },
            },
          },
        },
        paymentPlan: {
          select: {
            title: true,
            installments: {
              orderBy: {
                sortOrder: "asc",
              },
              select: {
                id: true,
                title: true,
                amount: true,
                dueInDays: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            providerReference: true,
            amount: true,
            status: true,
            method: true,
            installmentId: true,
            marketer: {
              select: {
                fullName: true,
                title: true,
                slug: true,
                avatarUrl: true,
              },
            },
            receipt: {
              select: {
                id: true,
                receiptNumber: true,
                issuedAt: true,
                totalAmount: true,
              },
            },
          },
        },
        paymentRequests: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
            collectionMethod: true,
            dueAt: true,
            expiresAt: true,
            providerReference: true,
            checkoutUrl: true,
            transferBankName: true,
            transferAccountNumber: true,
            transferAccountName: true,
            notes: true,
          },
        },
      },
    } as Parameters<typeof prisma.transaction.findFirst>[0],
  )) as {
    id: string;
    totalValue: { toNumber?: () => number } | number;
    outstandingBalance: { toNumber?: () => number } | number;
    marketer: { fullName: string; title: string; slug: string; avatarUrl: string | null } | null;
    reservation: {
      createdAt: Date;
      marketer: { fullName: string; title: string; slug: string; avatarUrl: string | null } | null;
    } | null;
    paymentPlan: {
      title: string;
      installments: Array<{
        id: string;
        title: string;
        amount: { toNumber?: () => number } | number;
        dueInDays: number;
      }>;
    } | null;
    payments: Array<{
      id: string;
      providerReference: string;
      amount: { toNumber?: () => number } | number;
      status: string;
      method: string;
      installmentId: string | null;
      marketer: { fullName: string; title: string; slug: string; avatarUrl: string | null } | null;
      receipt: {
        id: string;
        receiptNumber: string;
        issuedAt: Date;
        totalAmount: { toNumber?: () => number } | number;
      } | null;
    }>;
    paymentRequests: Array<{
      id: string;
      title: string;
      amount: { toNumber?: () => number } | number;
      status: string;
      collectionMethod: string;
      dueAt: Date | null;
      expiresAt: Date | null;
      providerReference: string | null;
      checkoutUrl: string | null;
      transferBankName: string | null;
      transferAccountNumber: string | null;
      transferAccountName: string | null;
      notes: string | null;
    }>;
  } | null;

  if (!transaction) {
    return {
      progress: buildBuyerPaymentProgress({
        totalPayableAmount: 0,
        amountPaidSoFar: 0,
      }),
      paymentStatus: "PENDING" as const,
      nextDueDate: null,
      selectedMarketer: null,
      selectedPaymentPlan: null,
      receipts: [],
      payments: [],
      paymentRequests: [],
    };
  }

  const paidAmount = transaction.payments
    .filter((payment) => payment.status === "SUCCESS")
    .reduce((sum, payment) => {
      const amount =
        typeof payment.amount === "number"
          ? payment.amount
          : payment.amount.toNumber?.() ?? Number(payment.amount);
      return sum + amount;
    }, 0);

  const schedule = transaction.paymentPlan?.installments.length
    ? buildTransactionInstallmentSchedule({
        startedAt: transaction.reservation?.createdAt ?? new Date(),
        installments: transaction.paymentPlan.installments,
        payments: transaction.payments,
      })
    : [];

  const progress = buildBuyerPaymentProgress({
    totalPayableAmount:
      typeof transaction.totalValue === "number"
        ? transaction.totalValue
        : transaction.totalValue.toNumber?.() ?? Number(transaction.totalValue),
    amountPaidSoFar: paidAmount,
    installmentSchedule: schedule.map((entry) => ({
      title: entry.title,
      amount: entry.amount,
      status: entry.status,
      dueDate: formatDate(entry.dueDate),
    })),
  });

  const paymentSummary = summarizeTransactionPayment({
    totalValue: transaction.totalValue,
    outstandingBalance: transaction.outstandingBalance,
    schedule,
    payments: transaction.payments,
  });

  const receiptRows = transaction.payments
    .filter((payment) => payment.receipt)
    .map((payment) => ({
      id: payment.receipt!.id,
      receiptNumber: payment.receipt!.receiptNumber,
      amount: formatCurrency(
        typeof payment.receipt!.totalAmount === "number"
          ? payment.receipt!.totalAmount
          : payment.receipt!.totalAmount.toNumber?.() ?? Number(payment.receipt!.totalAmount),
      ),
      issuedAt: formatDate(payment.receipt!.issuedAt),
      downloadHref: `/api/receipts/${payment.receipt!.id}/download`,
    }));

  const resolvedMarketer = resolveBuyerPaymentMarketer({
    payments: transaction.payments
      .filter((payment) => payment.status !== "AWAITING_INITIATION")
      .map((payment) => ({
        marketer: payment.marketer
          ? {
              fullName: payment.marketer.fullName,
              title: payment.marketer.title,
              slug: payment.marketer.slug,
              avatarUrl: payment.marketer.avatarUrl,
            }
          : null,
      })),
    transactionMarketer: transaction.marketer
      ? {
          fullName: transaction.marketer.fullName,
          title: transaction.marketer.title,
          slug: transaction.marketer.slug,
          avatarUrl: transaction.marketer.avatarUrl,
        }
      : null,
    reservationMarketer: transaction.reservation?.marketer
      ? {
          fullName: transaction.reservation.marketer.fullName,
          title: transaction.reservation.marketer.title,
          slug: transaction.reservation.marketer.slug,
          avatarUrl: transaction.reservation.marketer.avatarUrl,
        }
      : null,
  });

  return {
    progress,
    paymentStatus: paymentSummary.status,
    nextDueDate: paymentSummary.nextDue ? formatDate(paymentSummary.nextDue.dueDate) : null,
    selectedMarketer: resolvedMarketer,
    selectedPaymentPlan: transaction.paymentPlan?.title ?? null,
    receipts: receiptRows,
    payments: transaction.payments
      .filter((payment) => payment.status !== "AWAITING_INITIATION")
      .map((payment) => ({
      reference: payment.providerReference,
      amount: formatCurrency(
        typeof payment.amount === "number"
          ? payment.amount
          : payment.amount.toNumber?.() ?? Number(payment.amount),
      ),
      status: payment.status,
      method: payment.method,
      receiptHref: payment.receipt ? `/api/receipts/${payment.receipt.id}/download` : null,
    })),
    paymentRequests: transaction.paymentRequests.map((request) => ({
      id: request.id,
      title: request.title,
      amount: formatCurrency(
        typeof request.amount === "number" ? request.amount : request.amount.toNumber?.() ?? Number(request.amount),
      ),
      status: request.status,
      collectionMethod: request.collectionMethod,
      dueAt: request.dueAt ? formatDate(request.dueAt) : null,
      expiresAt: request.expiresAt ? formatDate(request.expiresAt) : null,
      reference: request.providerReference,
      checkoutUrl: request.checkoutUrl,
      transferSummary: request.transferAccountNumber
        ? `${request.transferBankName ?? "Bank"} / ${request.transferAccountNumber}${request.transferAccountName ? ` (${request.transferAccountName})` : ""}`
        : request.collectionMethod === "BANK_TRANSFER_TEMP_ACCOUNT"
          ? "Open the payment link to view the temporary transfer account issued by Paystack."
          : null,
      notes: request.notes,
    })),
  };
}

export async function getBuyerDocumentsTable(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return [["allocation-letter.pdf", "AGREEMENT", "PRIVATE", "2026-03-27"]];
  }

  const documents = (await findManyForTenant(
    prisma.document as ScopedFindManyDelegate,
    context,
    {
      where: {
        OR: [
          { userId: context.userId },
          { transaction: { userId: context.userId } },
        ],
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        fileName: true,
        documentType: true,
        visibility: true,
        updatedAt: true,
        userId: true,
        transaction: {
          select: {
            userId: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.document.findMany>[0],
  )) as Array<{
    id: string;
    fileName: string;
    documentType: string;
    visibility: string;
    updatedAt: Date;
    userId: string | null;
    transaction: { userId: string; companyId: string } | null;
  }>;

  return documents
    .filter((document) =>
      isBuyerOwnedDocumentRecord({
        viewerCompanyId: context.companyId,
        viewerUserId: context.userId,
        documentUserId: document.userId,
        transactionCompanyId: document.transaction?.companyId,
        transactionUserId: document.transaction?.userId,
      }),
    )
    .map((document) => [
      document.fileName,
      document.documentType,
      document.visibility,
      formatDate(document.updatedAt),
    ]);
}

export async function getBuyerDocumentsList(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return [
      {
        id: "demo-document",
        fileName: "RCT-PAY-11082.pdf",
        documentType: "RECEIPT",
        visibility: "PRIVATE",
        updatedAt: "2026-03-27",
        href: "/api/documents/demo-document/download",
      },
    ];
  }

  const documents = (await findManyForTenant(
    prisma.document as ScopedFindManyDelegate,
    context,
    {
      where: {
        OR: [{ userId: context.userId }, { transaction: { userId: context.userId } }],
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        fileName: true,
        documentType: true,
        visibility: true,
        updatedAt: true,
        userId: true,
        transaction: {
          select: {
            userId: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.document.findMany>[0],
  )) as Array<{
    id: string;
    fileName: string;
    documentType: string;
    visibility: string;
    updatedAt: Date;
    userId: string | null;
    transaction: { userId: string; companyId: string } | null;
  }>;

  return documents
    .filter((document) =>
      isBuyerOwnedDocumentRecord({
        viewerCompanyId: context.companyId,
        viewerUserId: context.userId,
        documentUserId: document.userId,
        transactionCompanyId: document.transaction?.companyId,
        transactionUserId: document.transaction?.userId,
      }),
    )
    .map((document) => ({
      id: document.id,
      fileName: document.fileName,
      documentType: document.documentType,
      visibility: document.visibility,
      updatedAt: formatDate(document.updatedAt),
      href: `/api/documents/${document.id}/download`,
    }));
}

export async function getBuyerSavedProperties(context: TenantContext): Promise<PropertySummary[]> {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return demoProperties.slice(0, 2);
  }

  const saved = (await findManyForTenant(
    prisma.savedProperty as ScopedFindManyDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        property: {
          select: {
            id: true,
            slug: true,
            title: true,
            shortDescription: true,
            description: true,
            propertyType: true,
            status: true,
            isFeatured: true,
            lastVerifiedAt: true,
            verificationStatus: true,
            verificationDueAt: true,
            isPubliclyVisible: true,
            autoHiddenAt: true,
            priceFrom: true,
            priceTo: true,
            bedrooms: true,
            bathrooms: true,
            parkingSpaces: true,
            sizeSqm: true,
            locationSummary: true,
            landmarks: true,
            location: {
              select: {
                city: true,
                state: true,
                longitude: true,
                latitude: true,
                companyId: true,
              },
            },
            media: {
              where: {
                visibility: "PUBLIC",
              },
              orderBy: {
                sortOrder: "asc",
              },
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
                description: true,
                durationMonths: true,
                depositPercent: true,
              },
            },
            features: {
              orderBy: {
                label: "asc",
              },
              select: {
                label: true,
              },
            },
            inquiries: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    } as Parameters<typeof prisma.savedProperty.findMany>[0],
  )) as Array<{
    property: {
      id: string;
      slug: string;
      title: string;
      shortDescription: string;
      description: string;
      propertyType: string;
      status: string;
      isFeatured: boolean;
      lastVerifiedAt: Date | null;
      verificationStatus: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN";
      verificationDueAt: Date;
      isPubliclyVisible: boolean;
      autoHiddenAt: Date | null;
      priceFrom: { toNumber?: () => number } | number;
      priceTo: { toNumber?: () => number } | number | null;
      bedrooms: number | null;
      bathrooms: number | null;
      parkingSpaces: number | null;
      sizeSqm: { toNumber?: () => number } | number | null;
      locationSummary: string | null;
      landmarks: unknown;
      location: {
        city: string;
        state: string;
        longitude: { toNumber?: () => number } | number | null;
        latitude: { toNumber?: () => number } | number | null;
        companyId: string;
      } | null;
      media: Array<{ url: string }>;
      paymentPlans: Array<{
        title: string;
        description: string | null;
        durationMonths: number;
        depositPercent: { toNumber?: () => number } | number | null;
      }>;
      features: Array<{ label: string }>;
      inquiries: Array<{ id: string }>;
    };
  }>;

  return saved
    .filter((item) => item.property.location?.companyId === context.companyId)
    .map((item) => mapPropertyRecordToSummary(item.property));
}

export async function getBuyerNotifications(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return buyerNotifications;
  }

  const notifications = (await findManyForTenant(
    prisma.notification as ScopedFindManyDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        title: true,
        body: true,
        createdAt: true,
      },
    } as Parameters<typeof prisma.notification.findMany>[0],
  )) as Array<{
    title: string;
    body: string;
    createdAt: Date;
  }>;

  return notifications.map((notification) => ({
    title: notification.title,
    body: notification.body,
    time: formatDate(notification.createdAt, "PPP p"),
  }));
}

export async function getBuyerTimeline(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return buyerTimeline;
  }

  const transaction = (await findFirstForTenant(
    prisma.transaction as ScopedFindFirstDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        userId: true,
        companyId: true,
        milestones: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            title: true,
            description: true,
            status: true,
            completedAt: true,
            dueAt: true,
          },
        },
      },
    } as Parameters<typeof prisma.transaction.findFirst>[0],
  )) as {
    userId: string;
    companyId: string;
    milestones: Array<{
      title: string;
      description: string | null;
      status: string;
      completedAt: Date | null;
      dueAt: Date | null;
    }>;
  } | null;

  if (
    !transaction ||
    !isBuyerOwnedTransactionRecord({
      viewerCompanyId: context.companyId,
      viewerUserId: context.userId,
      recordCompanyId: transaction.companyId,
      recordUserId: transaction.userId,
    })
  ) {
    return [];
  }

  return transaction.milestones.map((milestone) => ({
    title: milestone.title,
    description: milestone.description ?? "Milestone update recorded.",
    status: mapMilestoneStatusToTimelineStatus(milestone.status),
    date: milestone.completedAt
      ? formatDate(milestone.completedAt)
      : milestone.dueAt
        ? formatDate(milestone.dueAt)
        : "Pending",
  }));
}

export async function getBuyerDashboardSummary(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      overview: buyerOverview,
      timeline: buyerTimeline,
      notifications: buyerNotifications,
    };
  }

  const [user, transaction, unreadNotifications, notifications] = await Promise.all([
    findFirstForTenant(
      prisma.user as ScopedFindFirstDelegate,
      context,
      {
        where: {
          id: context.userId,
        },
        select: {
          profile: {
            select: {
              profileCompleted: true,
            },
          },
        },
      } as Parameters<typeof prisma.user.findFirst>[0],
    ),
    findFirstForTenant(
      prisma.transaction as ScopedFindFirstDelegate,
      context,
      {
        where: {
          userId: context.userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          outstandingBalance: true,
          nextPaymentDueAt: true,
          paymentStatus: true,
          reservation: {
            select: {
              reference: true,
            },
          },
          payments: {
            where: {
              status: {
                in: ["PENDING", "OVERDUE"],
              },
            },
            orderBy: {
              createdAt: "asc",
            },
            select: {
              createdAt: true,
            },
            take: 1,
          },
        },
      } as Parameters<typeof prisma.transaction.findFirst>[0],
    ),
    findManyForTenant(
      prisma.notification as ScopedFindManyDelegate,
      context,
      {
        where: {
          userId: context.userId,
          readAt: null,
        },
        select: {
          id: true,
        },
      } as Parameters<typeof prisma.notification.findMany>[0],
    ),
    getBuyerNotifications(context),
  ]);

  const currentUser = user as {
    profile: {
      profileCompleted: boolean;
    } | null;
  } | null;
  const currentTransaction = transaction as {
    outstandingBalance: { toNumber?: () => number } | number;
    nextPaymentDueAt: Date | null;
    paymentStatus: string;
    reservation: { reference: string } | null;
    payments: Array<{ createdAt: Date }>;
  } | null;

  return {
    overview: {
      completion: currentUser?.profile?.profileCompleted ? 100 : 60,
      outstandingBalance:
        currentTransaction?.outstandingBalance == null
          ? 0
          : typeof currentTransaction.outstandingBalance === "number"
            ? currentTransaction.outstandingBalance
            : currentTransaction.outstandingBalance.toNumber?.() ??
              Number(currentTransaction.outstandingBalance),
      nextPaymentDue: currentTransaction?.nextPaymentDueAt
        ? formatDate(currentTransaction.nextPaymentDueAt)
        : "No due payment",
      activeReservation: currentTransaction?.reservation?.reference ?? "No reservation",
      notificationsUnread: (unreadNotifications as Array<{ id: string }>).length,
    },
    timeline: await getBuyerTimeline(context),
    notifications: notifications.slice(0, 3),
  };
}

function mapPropertyRecordToSummary(property: {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  propertyType: string;
  status: string;
  isFeatured: boolean;
  lastVerifiedAt: Date | null;
  verificationStatus: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN";
  verificationDueAt: Date;
  isPubliclyVisible: boolean;
  autoHiddenAt: Date | null;
  priceFrom: { toNumber?: () => number } | number;
  priceTo: { toNumber?: () => number } | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  sizeSqm: { toNumber?: () => number } | number | null;
  locationSummary: string | null;
  landmarks: unknown;
  location: {
    city: string;
    state: string;
    longitude: { toNumber?: () => number } | number | null;
    latitude: { toNumber?: () => number } | number | null;
    companyId: string;
  } | null;
  media: Array<{ url: string }>;
  paymentPlans: Array<{
    title: string;
    description: string | null;
    durationMonths: number;
    depositPercent: { toNumber?: () => number } | number | null;
  }>;
  features: Array<{ label: string }>;
  inquiries: Array<{ id: string }>;
}): PropertySummary {
  const paymentPlan = property.paymentPlans[0];
  const verification = buildPropertyVerificationPresentation({
    lastVerifiedAt: property.lastVerifiedAt,
    verificationStatus: property.verificationStatus,
    verificationDueAt: property.verificationDueAt,
    isPubliclyVisible: property.isPubliclyVisible,
    autoHiddenAt: property.autoHiddenAt,
  });

  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    shortDescription: property.shortDescription,
    description: property.description,
    type: property.propertyType.replaceAll("_", " "),
    status: property.status.toLowerCase() as PropertySummary["status"],
    featured: property.isFeatured,
    priceFrom:
      typeof property.priceFrom === "number"
        ? property.priceFrom
        : property.priceFrom.toNumber?.() ?? Number(property.priceFrom),
    priceTo:
      property.priceTo == null
        ? undefined
        : typeof property.priceTo === "number"
          ? property.priceTo
          : property.priceTo.toNumber?.() ?? Number(property.priceTo),
    bedrooms: property.bedrooms ?? 0,
    bathrooms: property.bathrooms ?? 0,
    parkingSpaces: property.parkingSpaces ?? 0,
    sizeSqm:
      property.sizeSqm == null
        ? 0
        : typeof property.sizeSqm === "number"
          ? property.sizeSqm
          : property.sizeSqm.toNumber?.() ?? Number(property.sizeSqm),
    locationSummary: property.locationSummary ?? `${property.location?.city ?? ""}, ${property.location?.state ?? ""}`.trim(),
    city: property.location?.city ?? "Unknown",
    state: property.location?.state ?? "Unknown",
    coordinates: [
      property.location?.longitude == null
        ? 0
        : typeof property.location.longitude === "number"
          ? property.location.longitude
          : property.location.longitude.toNumber?.() ?? Number(property.location.longitude),
      property.location?.latitude == null
        ? 0
        : typeof property.location.latitude === "number"
          ? property.location.latitude
          : property.location.latitude.toNumber?.() ?? Number(property.location.latitude),
    ],
    images: property.media.map((item) => item.url),
    paymentPlan: {
      title: paymentPlan?.title ?? "Flexible payment plan",
      summary: paymentPlan?.description ?? "Structured payment options available.",
      durationMonths: paymentPlan?.durationMonths ?? 0,
      depositPercent:
        paymentPlan?.depositPercent == null
          ? 0
          : typeof paymentPlan.depositPercent === "number"
            ? paymentPlan.depositPercent
            : paymentPlan.depositPercent.toNumber?.() ?? Number(paymentPlan.depositPercent),
    },
    features: property.features.map((feature) => feature.label),
    landmarks: Array.isArray(property.landmarks)
      ? property.landmarks.filter((landmark): landmark is string => typeof landmark === "string")
      : [],
    brochureName: "brochure.pdf",
    inquiryCount: property.inquiries.length,
    verification: {
      status: verification.status,
      label: verification.label,
      detail: verification.detail,
      tone: verification.tone,
      isPubliclyVisible: verification.isPubliclyVisible,
      lastVerifiedAt: verification.lastVerifiedAt?.toISOString(),
      verificationDueAt: verification.verificationDueAt.toISOString(),
    },
  };
}

function mapMilestoneStatusToTimelineStatus(
  status: string,
): "completed" | "active" | "pending" {
  if (status === "COMPLETED") {
    return "completed";
  }

  if (status === "ACTIVE") {
    return "active";
  }

  return "pending";
}






