import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";

export type FrontDeskTone = "brand" | "amber" | "green" | "neutral";

export type FrontDeskStat = {
  key: string;
  label: string;
  value: number;
  tone: FrontDeskTone;
  icon: string;
};

export type FrontDeskActivity = {
  id: string;
  kind: "lead" | "viewing";
  title: string;
  detail: string;
  when: string;
};

export type FrontDeskOverview = {
  stats: FrontDeskStat[];
  activity: FrontDeskActivity[];
};

const ACTIVE_INSPECTION_STATUSES = [
  "PENDING",
  "REQUESTED",
  "CONFIRMED",
  "RESCHEDULED",
] as const;

function buildStats(values: {
  newLeadsToday: number;
  awaitingResponse: number;
  viewingsToday: number;
  upcomingViewings: number;
  openReservations: number;
  activeLeads: number;
}): FrontDeskStat[] {
  return [
    { key: "newLeadsToday", label: "New leads today", value: values.newLeadsToday, tone: "brand", icon: "UserPlus" },
    { key: "awaitingResponse", label: "Awaiting response", value: values.awaitingResponse, tone: "amber", icon: "Clock" },
    { key: "viewingsToday", label: "Viewings today", value: values.viewingsToday, tone: "brand", icon: "CalendarCheck" },
    { key: "upcomingViewings", label: "Upcoming viewings", value: values.upcomingViewings, tone: "neutral", icon: "CalendarClock" },
    { key: "openReservations", label: "Open reservations", value: values.openReservations, tone: "green", icon: "BadgeCheck" },
    { key: "activeLeads", label: "Active leads", value: values.activeLeads, tone: "neutral", icon: "Users" },
  ];
}

function emptyOverview(): FrontDeskOverview {
  return {
    stats: buildStats({
      newLeadsToday: 0,
      awaitingResponse: 0,
      viewingsToday: 0,
      upcomingViewings: 0,
      openReservations: 0,
      activeLeads: 0,
    }),
    activity: [],
  };
}

function relativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Front-desk operations snapshot, assembled from existing CRM data (inquiries,
 * inspection bookings, reservations). Never throws — on any failure or when the
 * database is unavailable it returns a zeroed snapshot so the dashboard always
 * renders.
 */
export async function getFrontDeskOverview(context: {
  companyId: string | null;
}): Promise<FrontDeskOverview> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return emptyOverview();
  }

  const companyId = context.companyId;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  try {
    const [
      newLeadsToday,
      awaitingResponse,
      viewingsToday,
      upcomingViewings,
      openReservations,
      activeLeads,
      recentInquiries,
      recentBookings,
    ] = await Promise.all([
      prisma.inquiry.count({ where: { companyId, createdAt: { gte: startOfToday } } }),
      prisma.inquiry.count({ where: { companyId, status: "NEW" } }),
      prisma.inspectionBooking.count({
        where: { companyId, scheduledFor: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      prisma.inspectionBooking.count({
        where: {
          companyId,
          scheduledFor: { gte: now },
          status: { in: [...ACTIVE_INSPECTION_STATUSES] },
        },
      }),
      prisma.reservation.count({ where: { companyId, status: { in: ["PENDING", "ACTIVE"] } } }),
      prisma.inquiry.count({ where: { companyId, status: { notIn: ["CLOSED", "LOST", "CONVERTED"] } } }),
      prisma.inquiry.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, fullName: true, message: true, createdAt: true },
      }),
      prisma.inspectionBooking.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, fullName: true, scheduledFor: true, createdAt: true },
      }),
    ]);

    const activity: FrontDeskActivity[] = [
      ...recentInquiries.map((row) => ({
        id: `lead-${row.id}`,
        kind: "lead" as const,
        title: `${row.fullName} sent an inquiry`,
        detail: row.message.length > 90 ? `${row.message.slice(0, 90)}…` : row.message,
        createdAt: row.createdAt,
      })),
      ...recentBookings.map((row) => ({
        id: `viewing-${row.id}`,
        kind: "viewing" as const,
        title: `${row.fullName} booked a viewing`,
        detail: `Scheduled for ${row.scheduledFor.toLocaleDateString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        createdAt: row.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map(({ createdAt, ...rest }) => ({ ...rest, when: relativeTime(createdAt, now) }));

    return {
      stats: buildStats({
        newLeadsToday,
        awaitingResponse,
        viewingsToday,
        upcomingViewings,
        openReservations,
        activeLeads,
      }),
      activity,
    };
  } catch (error) {
    logError("Front desk overview lookup failed; returning empty snapshot.", {
      route: "/admin/front-desk",
      companyId,
      ...buildSafeErrorLogContext(error),
    });
    return emptyOverview();
  }
}
