import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";

export type VisitorStatus = "CHECKED_IN" | "CHECKED_OUT";

export type VisitorRow = {
  id: string;
  fullName: string;
  purpose: string | null;
  hostName: string | null;
  phone: string | null;
  status: VisitorStatus;
  when: string;
};

export type CallRow = {
  id: string;
  callerName: string;
  direction: "INBOUND" | "OUTBOUND";
  purpose: string | null;
  outcome: string | null;
  phone: string | null;
  when: string;
};

export type FrontDeskLogbook = {
  visitorsToday: number;
  activeVisitors: number;
  callsToday: number;
  visitors: VisitorRow[];
  calls: CallRow[];
};

const EMPTY: FrontDeskLogbook = {
  visitorsToday: 0,
  activeVisitors: 0,
  callsToday: 0,
  visitors: [],
  calls: [],
};

function timeLabel(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today's visitor + call counts only. Degrades to zeros if the logbook tables
 *  are not present yet, so callers (e.g. the front-desk overview) stay safe. */
export async function getLogbookTodayCounts(
  companyId: string | null,
): Promise<{ visitorsToday: number; callsToday: number }> {
  if (!featureFlags.hasDatabase || !companyId) {
    return { visitorsToday: 0, callsToday: 0 };
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  try {
    const [visitorsToday, callsToday] = await Promise.all([
      prisma.visitor.count({ where: { companyId, checkedInAt: { gte: startOfToday } } }),
      prisma.callLog.count({ where: { companyId, createdAt: { gte: startOfToday } } }),
    ]);
    return { visitorsToday, callsToday };
  } catch {
    // Tables not migrated yet — treat as zero rather than failing the caller.
    return { visitorsToday: 0, callsToday: 0 };
  }
}

/**
 * Full front-desk logbook (recent visitors + calls and today's counts). Never
 * throws — if the Visitor/CallLog tables have not been migrated yet it returns an
 * empty logbook so the page renders cleanly until the migration is applied.
 */
export async function getFrontDeskLogbook(context: {
  companyId: string | null;
}): Promise<FrontDeskLogbook> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return EMPTY;
  }

  const companyId = context.companyId;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  try {
    const [visitorsToday, activeVisitors, callsToday, visitors, calls] = await Promise.all([
      prisma.visitor.count({ where: { companyId, checkedInAt: { gte: startOfToday } } }),
      prisma.visitor.count({ where: { companyId, status: "CHECKED_IN" } }),
      prisma.callLog.count({ where: { companyId, createdAt: { gte: startOfToday } } }),
      prisma.visitor.findMany({
        where: { companyId },
        orderBy: { checkedInAt: "desc" },
        take: 10,
        select: {
          id: true,
          fullName: true,
          purpose: true,
          hostName: true,
          phone: true,
          status: true,
          checkedInAt: true,
        },
      }),
      prisma.callLog.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          callerName: true,
          direction: true,
          purpose: true,
          outcome: true,
          phone: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      visitorsToday,
      activeVisitors,
      callsToday,
      visitors: visitors.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        purpose: row.purpose,
        hostName: row.hostName,
        phone: row.phone,
        status: row.status as VisitorStatus,
        when: timeLabel(row.checkedInAt),
      })),
      calls: calls.map((row) => ({
        id: row.id,
        callerName: row.callerName,
        direction: row.direction as "INBOUND" | "OUTBOUND",
        purpose: row.purpose,
        outcome: row.outcome,
        phone: row.phone,
        when: timeLabel(row.createdAt),
      })),
    };
  } catch (error) {
    logError("Front desk logbook unavailable (migration pending?); returning empty logbook.", {
      route: "/admin/visitors",
      companyId,
      ...buildSafeErrorLogContext(error),
    });
    return EMPTY;
  }
}
