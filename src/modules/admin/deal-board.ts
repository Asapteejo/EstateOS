import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PRODUCT_EVENT_NAMES } from "@/modules/analytics/activity";

type Decimalish = Prisma.Decimal | { toNumber?: () => number } | number | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function buildRatio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(1));
}

function formatMoney(value: number, currency = "NGN") {
  return formatCurrency(value, currency);
}

function formatPersonName(input: { firstName?: string | null; lastName?: string | null; fallback?: string }) {
  const fullName = `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim();
  return fullName || input.fallback || "Unknown";
}

export type DealBoardStage = "NEW_LEADS" | "INSPECTIONS" | "RESERVED" | "PAYMENT_PENDING" | "PAID" | "OVERDUE";

export type DealBoardCard = {
  id: string;
  clientId: string | null;
  reservationId: string | null;
  stage: DealBoardStage;
  buyerName: string;
  propertyLabel: string;
  totalValue: number;
  amountPaid: number;
  outstandingBalance: number;
  ownerName: string;
  ownerRole: string;
  stageLabel: string;
  latestActivity: string;
  nextAction: string;
  dueLabel: string | null;
  overdueDays: number | null;
  followUpStatus: string | null;
  followUpNote: string | null;
  lastFollowedUpLabel: string | null;
  nextFollowUpLabel: string | null;
  riskScore: number;
  isAtRisk: boolean;
  primaryAction: { label: string; href: string };
  secondaryAction: { label: string; href: string };
};

type DealBoardColumn = {
  key: DealBoardStage;
  label: string;
  subtitle: string;
  tone: "neutral" | "warning" | "danger" | "success";
  cards: DealBoardCard[];
};

type ChecklistStep = {
  key: string;
  title: string;
  description: string;
  complete: boolean;
  href?: string;
};

type RecentEvent = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type DealBoardData = {
  summary: {
    totalDeals: number;
    totalAmountDue: number;
    totalAmountCollected: number;
    inquiryToReservationConversion: number;
    reservationToPaymentConversion: number;
    overdueCount: number;
    overdueAmount: number;
  };
  activation: {
    completedCount: number;
    total: number;
    steps: Array<{
      key: string;
      title: string;
      description: string;
      complete: boolean;
      href: string;
      ctaLabel: string;
    }>;
  };
  columns: DealBoardColumn[];
  checklist: {
    complete: boolean;
    steps: ChecklistStep[];
    sampleWorkspaceLoaded: boolean;
  };
  recentEvents: RecentEvent[];
  hasPaymentAccount: boolean;
};

const inquirySelect = Prisma.validator<Prisma.InquiryFindManyArgs>()({
  orderBy: { createdAt: "desc" },
  take: 12,
  select: {
    id: true,
    fullName: true,
    status: true,
    createdAt: true,
    property: {
      select: {
        title: true,
      },
    },
    assignedStaff: {
      select: {
        title: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    },
  },
});

const inspectionSelect = Prisma.validator<Prisma.InspectionBookingFindManyArgs>()({
  orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
  take: 12,
  select: {
    id: true,
    fullName: true,
    status: true,
    scheduledFor: true,
    createdAt: true,
    property: {
      select: {
        title: true,
      },
    },
    assignedStaff: {
      select: {
        title: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    },
  },
});

const transactionSelect = Prisma.validator<Prisma.TransactionFindManyArgs>()({
  orderBy: [{ paymentStatus: "desc" }, { updatedAt: "desc" }],
  take: 40,
  select: {
    id: true,
    currentStage: true,
    paymentStatus: true,
    totalValue: true,
    outstandingBalance: true,
    nextPaymentDueAt: true,
    lastPaymentAt: true,
    followUpStatus: true,
    followUpNote: true,
    lastFollowedUpAt: true,
    nextFollowUpAt: true,
    // riskScore is added after prisma generate — cast via any below
    updatedAt: true,
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    },
    property: {
      select: {
        title: true,
      },
    },
    propertyUnit: {
      select: {
        title: true,
      },
    },
    marketer: {
      select: {
        fullName: true,
        title: true,
      },
    },
    reservation: {
      select: {
        id: true,
        reference: true,
        createdAt: true,
      },
    },
    payments: {
      orderBy: {
        paidAt: "desc",
      },
      take: 1,
      select: {
        id: true,
        status: true,
        paidAt: true,
      },
    },
    paymentRequests: {
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
      select: {
        id: true,
        status: true,
        dueAt: true,
      },
    },
  },
});

const recentEventSelect = Prisma.validator<Prisma.ActivityEventFindManyArgs>()({
  orderBy: {
    createdAt: "desc",
  },
  take: 8,
  select: {
    id: true,
    eventName: true,
    summary: true,
    createdAt: true,
  },
});

export function classifyDealStage(input: {
  paymentStatus: string;
  currentStage: string;
  totalValue: number;
  outstandingBalance: number;
}): DealBoardStage {
  const amountPaid = Math.max(input.totalValue - input.outstandingBalance, 0);

  if (input.paymentStatus === "OVERDUE") {
    return "OVERDUE";
  }

  if (
    input.paymentStatus === "COMPLETED" ||
    input.outstandingBalance <= 0 ||
    input.currentStage === "FINAL_PAYMENT_COMPLETED" ||
    input.currentStage === "HANDOVER_COMPLETED"
  ) {
    return "PAID";
  }

  if (
    amountPaid <= 0 &&
    ["INQUIRY_RECEIVED", "KYC_SUBMITTED"].includes(input.currentStage)
  ) {
    return "RESERVED";
  }

  return "PAYMENT_PENDING";
}

function mapTransactionToStage(transaction: Prisma.TransactionGetPayload<typeof transactionSelect>): DealBoardStage {
  return classifyDealStage({
    paymentStatus: transaction.paymentStatus,
    currentStage: transaction.currentStage,
    totalValue: decimalToNumber(transaction.totalValue),
    outstandingBalance: decimalToNumber(transaction.outstandingBalance),
  });
}

function buildTransactionNextAction(transaction: Prisma.TransactionGetPayload<typeof transactionSelect>, stage: DealBoardStage) {
  if (stage === "OVERDUE") {
    if (transaction.followUpStatus === "PROMISED_TO_PAY" && transaction.nextFollowUpAt) {
      return `Next: confirm promised payment on ${formatDate(transaction.nextFollowUpAt, "PPP")}.`;
    }

    if (transaction.followUpStatus === "CONTACTED") {
      return "Next: confirm the buyer response and close or reschedule the collection action.";
    }

    if (transaction.followUpStatus === "NOT_REACHABLE") {
      return "Next: follow up again today and try a different contact path.";
    }

    return "Next: follow up today and confirm the next payment date.";
  }

  if (stage === "PAYMENT_PENDING") {
    return "Push the next installment and confirm collection timing.";
  }

  if (stage === "RESERVED") {
    return "Collect reservation money and move the deal into payment tracking.";
  }

  return "Review the client timeline and confirm the next milestone.";
}

function buildTransactionLatestActivity(transaction: Prisma.TransactionGetPayload<typeof transactionSelect>) {
  if (transaction.payments[0]?.paidAt) {
    return `Last payment ${formatDate(transaction.payments[0].paidAt, "PPP")}`;
  }

  if (transaction.paymentRequests[0]?.dueAt) {
    return `Latest request due ${formatDate(transaction.paymentRequests[0].dueAt, "PPP")}`;
  }

  return `Updated ${formatDate(transaction.updatedAt, "PPP")}`;
}

function getOverdueDays(nextPaymentDueAt: Date | null | undefined) {
  if (!nextPaymentDueAt) {
    return null;
  }

  const diff = Date.now() - nextPaymentDueAt.getTime();
  if (diff <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatFollowUpStatus(status: string | null | undefined) {
  if (!status || status === "NONE") {
    return null;
  }

  if (status === "PENDING_CALL") {
    return "Pending";
  }

  if (status === "CONTACTED") {
    return "Contacted";
  }

  if (status === "PROMISED_TO_PAY") {
    return "Promised to pay";
  }

  if (status === "NOT_REACHABLE") {
    return "Not reachable";
  }

  if (status === "CLOSED") {
    return "Resolved";
  }

  return status.toLowerCase().replaceAll("_", " ");
}

export function getPublicDemoDealBoard(): DealBoardData {
  return {
    summary: {
      totalDeals: 6,
      totalAmountDue: 184500000,
      totalAmountCollected: 96500000,
      inquiryToReservationConversion: 33.3,
      reservationToPaymentConversion: 75,
      overdueCount: 1,
      overdueAmount: 18500000,
    },
    activation: {
      completedCount: 1,
      total: 3,
      steps: [
        {
          key: "deal",
          title: "Create your first deal",
          description: "Open one buyer deal in the Deal Board.",
          complete: true,
          href: "/admin/deals/new",
          ctaLabel: "Create deal",
        },
        {
          key: "payment_request",
          title: "Send your first payment request",
          description: "Turn an active deal into a payable request.",
          complete: false,
          href: "/admin/payments",
          ctaLabel: "Send payment request",
        },
        {
          key: "payment",
          title: "Record your first payment",
          description: "Close the loop with a real or reconciled payment.",
          complete: false,
          href: "/admin/payments",
          ctaLabel: "Open payments",
        },
      ],
    },
    columns: [
      {
        key: "NEW_LEADS",
        label: "New Leads",
        subtitle: "Fresh buyers to qualify quickly",
        tone: "neutral",
        cards: [
          {
            id: "demo-lead",
            clientId: null,
            reservationId: null,
            stage: "NEW_LEADS",
            buyerName: "Ifeanyi Eze",
            propertyLabel: "Lekki Crest Homes",
            totalValue: 0,
            amountPaid: 0,
            outstandingBalance: 0,
            ownerName: "Unassigned",
            ownerRole: "New inquiry",
            stageLabel: "Qualified lead",
            latestActivity: "Inquiry received today",
            nextAction: "Call buyer and book an inspection.",
            dueLabel: null,
            overdueDays: null,
            followUpStatus: null,
            followUpNote: null,
            lastFollowedUpLabel: null,
            nextFollowUpLabel: null,
            riskScore: 0,
            isAtRisk: false,
            primaryAction: { label: "Open lead queue", href: "/admin/leads" },
            secondaryAction: { label: "View client profile", href: "/admin/clients" },
          },
          {
            id: "demo-lead-2",
            clientId: null,
            reservationId: null,
            stage: "NEW_LEADS",
            buyerName: "Amina Bello",
            propertyLabel: "Abuja Crest Residences",
            totalValue: 0,
            amountPaid: 0,
            outstandingBalance: 0,
            ownerName: "Kelechi Nwosu",
            ownerRole: "Lead owner",
            stageLabel: "CONTACTED",
            latestActivity: "Buyer asked for payment plan options this morning",
            nextAction: "Qualify budget and move to inspection this week.",
            dueLabel: null,
            overdueDays: null,
            followUpStatus: null,
            followUpNote: null,
            lastFollowedUpLabel: null,
            nextFollowUpLabel: null,
            riskScore: 0,
            isAtRisk: false,
            primaryAction: { label: "Open lead queue", href: "/admin/leads" },
            secondaryAction: { label: "View client profile", href: "/admin/clients" },
          },
        ],
      },
      {
        key: "INSPECTIONS",
        label: "Inspections",
        subtitle: "Buyers close to reservation",
        tone: "warning",
        cards: [
          {
            id: "demo-inspection",
            clientId: null,
            reservationId: null,
            stage: "INSPECTIONS",
            buyerName: "Chinonso Udeh",
            propertyLabel: "Lekki Crest Homes / 3 Bed Terrace B2",
            totalValue: 92000000,
            amountPaid: 0,
            outstandingBalance: 92000000,
            ownerName: "Mariam Yusuf",
            ownerRole: "Inspection owner",
            stageLabel: "CONFIRMED",
            latestActivity: "Inspection confirmed for Friday 11:00 AM",
            nextAction: "Confirm attendance and push the buyer toward reservation.",
            dueLabel: "Friday",
            overdueDays: null,
            followUpStatus: null,
            followUpNote: null,
            lastFollowedUpLabel: null,
            nextFollowUpLabel: null,
            riskScore: 0,
            isAtRisk: false,
            primaryAction: { label: "Open bookings", href: "/admin/bookings" },
            secondaryAction: { label: "Open clients", href: "/admin/clients" },
          },
        ],
      },
      {
        key: "RESERVED",
        label: "Reserved",
        subtitle: "Reserved deals waiting for the first money",
        tone: "warning",
        cards: [
          {
            id: "demo-reserved",
            clientId: "demo-client-reserved",
            reservationId: "demo-reservation-reserved",
            stage: "RESERVED",
            buyerName: "Adaeze Okafor",
            propertyLabel: "Eko Atlantic Heights / Penthouse 04",
            totalValue: 185000000,
            amountPaid: 0,
            outstandingBalance: 185000000,
            ownerName: "Kelechi Nwosu",
            ownerRole: "Lead owner",
            stageLabel: "KYC SUBMITTED",
            latestActivity: "Reservation fee expected this week",
            nextAction: "Collect reservation money and move the deal into payment tracking.",
            dueLabel: "Apr 11, 2026",
            overdueDays: null,
            followUpStatus: null,
            followUpNote: null,
            lastFollowedUpLabel: null,
            nextFollowUpLabel: null,
            riskScore: 0,
            isAtRisk: false,
            primaryAction: { label: "Open transaction", href: "/admin/transactions" },
            secondaryAction: { label: "Send payment request", href: "/admin/payments" },
          },
        ],
      },
      {
        key: "PAYMENT_PENDING",
        label: "Payment Pending",
        subtitle: "Installments to collect this week",
        tone: "warning",
        cards: [
          {
            id: "demo-pending",
            clientId: "demo-client-pending",
            reservationId: "demo-reservation-pending",
            stage: "PAYMENT_PENDING",
            buyerName: "Tunde Afolayan",
            propertyLabel: "Abuja Crest Residences / Duplex A7",
            totalValue: 126000000,
            amountPaid: 42000000,
            outstandingBalance: 84000000,
            ownerName: "Mariam Yusuf",
            ownerRole: "Senior marketer",
            stageLabel: "LEGAL VERIFICATION",
            latestActivity: "Payment request sent yesterday for NGN 21,000,000",
            nextAction: "Push the next installment and confirm collection timing.",
            dueLabel: "Apr 12, 2026",
            overdueDays: null,
            followUpStatus: "Contacted",
            followUpNote: "Buyer asked for the hosted payment link again on WhatsApp.",
            lastFollowedUpLabel: "Apr 7, 2026, 10:30 AM",
            nextFollowUpLabel: "Apr 10, 2026",
            riskScore: 0,
            isAtRisk: false,
            primaryAction: { label: "View payment history", href: "/admin/payments" },
            secondaryAction: { label: "Send payment request", href: "/admin/payments" },
          },
        ],
      },
      {
        key: "PAID",
        label: "Paid",
        subtitle: "Closed revenue and healthy deals",
        tone: "success",
        cards: [
          {
            id: "demo-paid",
            clientId: "demo-client-paid",
            reservationId: "demo-reservation-paid",
            stage: "PAID",
            buyerName: "Obinna Eze",
            propertyLabel: "Lekki Crest Homes / 4 Bed Duplex C1",
            totalValue: 98000000,
            amountPaid: 98000000,
            outstandingBalance: 0,
            ownerName: "Kelechi Nwosu",
            ownerRole: "Lead owner",
            stageLabel: "FINAL PAYMENT COMPLETED",
            latestActivity: "Final payment reconciled on Apr 5, 2026",
            nextAction: "Review the client timeline and confirm the next milestone.",
            dueLabel: null,
            overdueDays: null,
            followUpStatus: "Resolved",
            followUpNote: "Receipt issued and handover preparation started.",
            lastFollowedUpLabel: "Apr 6, 2026, 2:15 PM",
            nextFollowUpLabel: null,
            riskScore: 0,
            isAtRisk: false,
            primaryAction: { label: "View payment history", href: "/admin/payments" },
            secondaryAction: { label: "Open client", href: "/admin/clients" },
          },
        ],
      },
      {
        key: "OVERDUE",
        label: "Overdue",
        subtitle: "Revenue at risk right now",
        tone: "danger",
        cards: [
          {
            id: "demo-overdue",
            clientId: "demo-client-overdue",
            reservationId: "demo-reservation-overdue",
            stage: "OVERDUE",
            buyerName: "Chioma Nnadi",
            propertyLabel: "Victoria Garden Residences / Terrace D5",
            totalValue: 114000000,
            amountPaid: 42000000,
            outstandingBalance: 18500000,
            ownerName: "Mariam Yusuf",
            ownerRole: "Senior marketer",
            stageLabel: "LEGAL VERIFICATION",
            latestActivity: "Installment missed after reminder and hosted link resend",
            nextAction: "Next: follow up today and confirm the next payment date.",
            dueLabel: "Apr 2, 2026",
            overdueDays: 6,
            followUpStatus: "Not reachable",
            followUpNote: "Calls have not connected since Monday. Need alternate contact path today.",
            lastFollowedUpLabel: "Apr 6, 2026, 4:20 PM",
            nextFollowUpLabel: "Apr 8, 2026",
            riskScore: 0,
            isAtRisk: false,
            primaryAction: { label: "View payment history", href: "/admin/payments" },
            secondaryAction: { label: "Send payment request", href: "/admin/payments" },
          },
        ],
      },
    ],
    checklist: {
      complete: false,
      sampleWorkspaceLoaded: false,
      steps: [
        {
          key: "company",
          title: "Confirm company workspace",
          description: "Set the company basics before you start tracking buyers.",
          complete: true,
          href: "/admin/settings",
        },
        {
          key: "property",
          title: "Add your first property",
          description: "Start with one development or one saleable unit.",
          complete: false,
          href: "/admin/listings",
        },
        {
          key: "team",
          title: "Add one team member",
          description: "Assign a marketer or sales admin to own follow-up.",
          complete: false,
          href: "/admin/team",
        },
        {
          key: "deal",
          title: "Create your first deal",
          description: "Track one buyer from inquiry to payment.",
          complete: false,
          href: "/admin/deals/new",
        },
      ],
    },
    hasPaymentAccount: false,
    recentEvents: [
      {
        id: "demo-event-1",
        title: "Payment request sent for Duplex A7",
        detail: "Hosted checkout link delivered to Tunde Afolayan for the next installment.",
        createdAt: "Today, 9:10 AM",
      },
      {
        id: "demo-event-2",
        title: "Overdue follow-up escalated",
        detail: "Chioma Nnadi has one installment 6 days overdue and needs collections action now.",
        createdAt: "Today, 8:30 AM",
      },
      {
        id: "demo-event-3",
        title: "Final payment reconciled",
        detail: "Obinna Eze completed the final property payment and receipt was issued.",
        createdAt: "Yesterday, 3:45 PM",
      },
    ],
  };
}

export async function getAdminDealBoard(context: TenantContext): Promise<DealBoardData> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return getPublicDemoDealBoard();
  }

  const companyId = context.companyId;

  // riskScore is a new schema field not yet in generated Prisma types — fetch
  // transactions separately with an `as any` cast and run both in parallel.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txPromise = (prisma.transaction.findMany as (args: any) => Promise<any[]>)({
    ...transactionSelect,
    select: { ...transactionSelect.select, riskScore: true },
    where: { companyId },
  });

  const [
    propertyCount,
    teamMemberCount,
    inquiryCount,
    reservationCount,
    paymentRequestCount,
    paymentStats,
    overdueAgg,
    inquiries,
    inspections,
    recentEvents,
    sampleWorkspaceEvent,
    paymentAccountCount,
    transactions,
  ] = await Promise.all([
    prisma.property.count({ where: { companyId } }),
    prisma.teamMember.count({ where: { companyId, isActive: true } }),
    prisma.inquiry.count({ where: { companyId } }),
    prisma.reservation.count({ where: { companyId } }),
    prisma.paymentRequest.count({ where: { companyId } }),
    prisma.payment.aggregate({
      where: { companyId, status: "SUCCESS" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId, paymentStatus: "OVERDUE" },
      _count: { _all: true },
      _sum: { outstandingBalance: true },
    }),
    prisma.inquiry.findMany({
      ...inquirySelect,
      where: { companyId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } },
    }),
    prisma.inspectionBooking.findMany({
      ...inspectionSelect,
      where: {
        companyId,
        status: { in: ["PENDING", "REQUESTED", "CONFIRMED", "RESCHEDULED"] },
      },
    }),
    prisma.activityEvent.findMany({
      ...recentEventSelect,
      where: { companyId, eventName: { in: Object.values(PRODUCT_EVENT_NAMES) } },
    }),
    prisma.activityEvent.findFirst({
      where: { companyId, eventName: PRODUCT_EVENT_NAMES.sampleWorkspaceLoaded },
      select: { id: true },
    }),
    prisma.companyPaymentProviderAccount.count({
      where: { companyId, provider: "PAYSTACK", subaccountCode: { not: null } },
    }),
    txPromise,
  ]);

  const totalDeals = transactions.length;
  const successfulPaymentCount = paymentStats._count._all;
  const anySuccessfulPayments = (transactions as Prisma.TransactionGetPayload<typeof transactionSelect>[]).filter((transaction) =>
    transaction.payments.some((payment: { status: string }) => payment.status === "SUCCESS"),
  ).length;
  const dueAgg = transactions.reduce(
    (total: number, transaction: Prisma.TransactionGetPayload<typeof transactionSelect>) =>
      transaction.paymentStatus === "COMPLETED"
        ? total
        : total + decimalToNumber(transaction.outstandingBalance),
    0,
  );

  const summary = {
    totalDeals,
    totalAmountDue: dueAgg,
    totalAmountCollected: decimalToNumber(paymentStats._sum.amount),
    inquiryToReservationConversion: buildRatio(reservationCount, inquiryCount),
    reservationToPaymentConversion: buildRatio(anySuccessfulPayments, reservationCount),
    overdueCount: overdueAgg._count._all,
    overdueAmount: decimalToNumber(overdueAgg._sum.outstandingBalance),
  };

  const columns: DealBoardColumn[] = [
    {
      key: "NEW_LEADS",
      label: "New Leads",
      subtitle: "Fresh buyers to qualify and move to site visits",
      tone: "neutral",
      cards: inquiries.map((inquiry) => ({
        id: inquiry.id,
        clientId: null,
        reservationId: null,
        stage: "NEW_LEADS",
        buyerName: inquiry.fullName,
        propertyLabel: inquiry.property?.title ?? "General inquiry",
        totalValue: 0,
        amountPaid: 0,
        outstandingBalance: 0,
        ownerName: formatPersonName({
          firstName: inquiry.assignedStaff?.user.firstName,
          lastName: inquiry.assignedStaff?.user.lastName,
          fallback: "Unassigned",
        }),
        ownerRole: inquiry.assignedStaff?.title ?? "Lead owner",
        stageLabel: inquiry.status.replaceAll("_", " "),
        latestActivity: `Lead received ${formatDate(inquiry.createdAt, "PPP")}`,
        nextAction: "Qualify intent, confirm budget, and book an inspection.",
        dueLabel: null,
        overdueDays: null,
        followUpStatus: null,
        followUpNote: null,
        lastFollowedUpLabel: null,
        nextFollowUpLabel: null,
        riskScore: 0,
        isAtRisk: false,
        primaryAction: { label: "Open lead queue", href: "/admin/leads" },
        secondaryAction: { label: "Open clients", href: "/admin/clients" },
      })),
    },
    {
      key: "INSPECTIONS",
      label: "Inspections",
      subtitle: "Buyers who need guided follow-up after site visits",
      tone: "warning",
      cards: inspections.map((booking) => ({
        id: booking.id,
        clientId: null,
        reservationId: null,
        stage: "INSPECTIONS",
        buyerName: booking.fullName,
        propertyLabel: booking.property.title,
        totalValue: 0,
        amountPaid: 0,
        outstandingBalance: 0,
        ownerName: formatPersonName({
          firstName: booking.assignedStaff?.user.firstName,
          lastName: booking.assignedStaff?.user.lastName,
          fallback: "Unassigned",
        }),
        ownerRole: booking.assignedStaff?.title ?? "Inspection owner",
        stageLabel: booking.status.replaceAll("_", " "),
        latestActivity: `Inspection scheduled ${formatDate(booking.scheduledFor, "PPP p")}`,
        nextAction: "Confirm attendance and push the buyer toward reservation.",
        dueLabel: formatDate(booking.scheduledFor, "PPP"),
        overdueDays: null,
        followUpStatus: null,
        followUpNote: null,
        lastFollowedUpLabel: null,
        nextFollowUpLabel: null,
        riskScore: 0,
        isAtRisk: false,
        primaryAction: { label: "Open bookings", href: "/admin/bookings" },
        secondaryAction: { label: "Open clients", href: "/admin/clients" },
      })),
    },
    {
      key: "RESERVED",
      label: "Reserved",
      subtitle: "Deals waiting for the first money or contract progress",
      tone: "warning",
      cards: [],
    },
    {
      key: "PAYMENT_PENDING",
      label: "Payment Pending",
      subtitle: "Deals with money in motion and cash still outstanding",
      tone: "warning",
      cards: [],
    },
    {
      key: "PAID",
      label: "Paid",
      subtitle: "Collected revenue and closed deals",
      tone: "success",
      cards: [],
    },
    {
      key: "OVERDUE",
      label: "Overdue",
      subtitle: "Buyers who need collection action now",
      tone: "danger",
      cards: [],
    },
  ];

  const columnMap = new Map(columns.map((column) => [column.key, column]));
  for (const transaction of transactions) {
    const stage = mapTransactionToStage(transaction);
    const amountPaid = Math.max(decimalToNumber(transaction.totalValue) - decimalToNumber(transaction.outstandingBalance), 0);
    const column = columnMap.get(stage);

    column?.cards.push({
      id: transaction.id,
      clientId: transaction.user.id,
      reservationId: transaction.reservation.id,
      stage,
      buyerName: formatPersonName({
        firstName: transaction.user.firstName,
        lastName: transaction.user.lastName,
        fallback: "Buyer",
      }),
      propertyLabel: [transaction.property.title, transaction.propertyUnit?.title].filter(Boolean).join(" / "),
      totalValue: decimalToNumber(transaction.totalValue),
      amountPaid,
      outstandingBalance: decimalToNumber(transaction.outstandingBalance),
      ownerName: transaction.marketer?.fullName ?? "Unassigned",
      ownerRole: transaction.marketer?.title ?? "Marketer",
      stageLabel: transaction.currentStage.replaceAll("_", " "),
      latestActivity: buildTransactionLatestActivity(transaction),
      nextAction: buildTransactionNextAction(transaction, stage),
      dueLabel: transaction.nextPaymentDueAt ? formatDate(transaction.nextPaymentDueAt, "PPP") : null,
      overdueDays: stage === "OVERDUE" ? getOverdueDays(transaction.nextPaymentDueAt) : null,
      followUpStatus: formatFollowUpStatus(transaction.followUpStatus),
      followUpNote: transaction.followUpNote,
      lastFollowedUpLabel: transaction.lastFollowedUpAt
        ? formatDate(transaction.lastFollowedUpAt, "PPP p")
        : null,
      nextFollowUpLabel: transaction.nextFollowUpAt
        ? formatDate(transaction.nextFollowUpAt, "PPP")
        : null,
      riskScore: transaction.riskScore,
      isAtRisk: transaction.riskScore >= 50,
      primaryAction: {
        label: stage === "RESERVED" ? "Open transaction" : "View payment history",
        href: stage === "RESERVED" ? "/admin/transactions" : "/admin/payments",
      },
      secondaryAction: {
        label: stage === "PAID" ? "Open client" : "Send payment request",
        href: stage === "PAID" ? "/admin/clients" : "/admin/payments",
      },
    });
  }

  const overdueColumn = columnMap.get("OVERDUE");
  overdueColumn?.cards.sort((left, right) => {
    if (right.outstandingBalance !== left.outstandingBalance) {
      return right.outstandingBalance - left.outstandingBalance;
    }

    return (right.overdueDays ?? 0) - (left.overdueDays ?? 0);
  });

  const checklistSteps: ChecklistStep[] = [
    {
      key: "company",
      title: "Confirm company workspace",
      description: "Make sure your company identity and billing setup are in place.",
      complete: Boolean(companyId),
      href: "/admin/settings",
    },
    {
      key: "property",
      title: "Add your first property",
      description: "Start with one development or one saleable unit.",
      complete: propertyCount > 0,
      href: "/admin/listings",
    },
    {
      key: "team",
      title: "Add one team member",
      description: "Assign a marketer or sales admin to own follow-up.",
      complete: teamMemberCount > 0,
      href: "/admin/team",
    },
    {
      key: "deal",
      title: "Create your first deal",
      description: "Track one buyer from inquiry to payment in this board.",
      complete: totalDeals > 0,
      href: "/admin/deals/new",
    },
  ];

  const activationSteps = [
    {
      key: "deal",
      title: "Create your first deal",
      description: "Open one buyer deal so the board can start tracking revenue.",
      complete: totalDeals > 0,
      href: "/admin/deals/new",
      ctaLabel: "Create deal",
    },
    {
      key: "payment_request",
      title: "Send your first payment request",
      description: "Turn an active deal into a payable request.",
      complete: paymentRequestCount > 0,
      href: "/admin/payments",
      ctaLabel: "Send payment request",
    },
    {
      key: "payment",
      title: "Record your first payment",
      description: "Track the first successful payment and revenue collection.",
      complete: successfulPaymentCount > 0,
      href: "/admin/payments",
      ctaLabel: "Open payments",
    },
  ];

  return {
    summary,
    activation: {
      completedCount: activationSteps.filter((step) => step.complete).length,
      total: activationSteps.length,
      steps: activationSteps,
    },
    columns,
    checklist: {
      complete: checklistSteps.every((step) => step.complete),
      steps: checklistSteps,
      sampleWorkspaceLoaded: Boolean(sampleWorkspaceEvent),
    },
    hasPaymentAccount: paymentAccountCount > 0,
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      title: event.summary,
      detail: event.eventName.replaceAll(".", " ").replaceAll("_", " "),
      createdAt: formatDate(event.createdAt, "PPP p"),
    })),
  };
}

export type DealBoardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type DealBoardAnalyticsReport = {
  metrics: DealBoardMetric[];
  recentEvents: RecentEvent[];
};

export async function getDealBoardAnalyticsReport(context: TenantContext): Promise<DealBoardAnalyticsReport> {
  const board = await getAdminDealBoard(context);

  return {
    metrics: [
      {
        label: "Total deals",
        value: String(board.summary.totalDeals),
        detail: "Reservations and transactions currently tracked in the workspace.",
      },
      {
        label: "Total amount due",
        value: formatMoney(board.summary.totalAmountDue),
        detail: "Outstanding collections across reserved, pending, and overdue deals.",
      },
      {
        label: "Total amount collected",
        value: formatMoney(board.summary.totalAmountCollected),
        detail: "Successful payments reconciled from the payment authority layer.",
      },
      {
        label: "Inquiry → reservation",
        value: `${board.summary.inquiryToReservationConversion}%`,
        detail: "How many leads become actual deals.",
      },
      {
        label: "Reservation → payment",
        value: `${board.summary.reservationToPaymentConversion}%`,
        detail: "How many deals progress into collected money.",
      },
      {
        label: "Overdue risk",
        value: `${board.summary.overdueCount} deals / ${formatMoney(board.summary.overdueAmount)}`,
        detail: "Revenue that needs collections follow-up now.",
      },
    ],
    recentEvents: board.recentEvents,
  };
}
