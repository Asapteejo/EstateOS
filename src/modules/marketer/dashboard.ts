import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { formatDate } from "@/lib/utils";

export type MarketerLead = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  propertyTitle: string;
  when: string;
};

export type MarketerInspection = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  propertyTitle: string;
  when: string;
};

export type MarketerDashboard = {
  hasProfile: boolean;
  stats: { assignedLeads: number; openLeads: number; upcomingInspections: number };
  leads: MarketerLead[];
  inspections: MarketerInspection[];
};

const CLOSED_LEAD_STATUSES = new Set(["CONVERTED", "CLOSED", "LOST"]);

const EMPTY: MarketerDashboard = {
  hasProfile: false,
  stats: { assignedLeads: 0, openLeads: 0, upcomingInspections: 0 },
  leads: [],
  inspections: [],
};

/**
 * Personal cockpit for a logged-in marketer: the leads and inspections assigned
 * to them, scoped by their StaffProfile. Degrades to an empty (no-profile) state
 * when there is no DB, company, or linked staff profile.
 */
export async function getMarketerDashboard(context: TenantContext): Promise<MarketerDashboard> {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return EMPTY;
  }

  const staff = await prisma.staffProfile.findFirst({
    where: {
      user: { is: { OR: [{ id: context.userId }, { clerkUserId: context.userId }] } },
    },
    select: { id: true },
  });
  if (!staff) {
    return EMPTY;
  }

  const [leads, inspections] = await Promise.all([
    prisma.inquiry.findMany({
      where: { companyId: context.companyId, assignedStaffId: staff.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        property: { select: { title: true } },
      },
    }),
    prisma.inspectionBooking.findMany({
      where: { companyId: context.companyId, assignedStaffId: staff.id },
      orderBy: { scheduledFor: "asc" },
      take: 12,
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        scheduledFor: true,
        property: { select: { title: true } },
      },
    }),
  ]);

  const now = Date.now();
  const openLeads = leads.filter((lead) => !CLOSED_LEAD_STATUSES.has(lead.status)).length;
  const upcomingInspections = inspections.filter(
    (item) => new Date(item.scheduledFor).getTime() >= now,
  ).length;

  return {
    hasProfile: true,
    stats: { assignedLeads: leads.length, openLeads, upcomingInspections },
    leads: leads.map((lead) => ({
      id: lead.id,
      name: lead.fullName,
      phone: lead.phone,
      status: lead.status.replaceAll("_", " "),
      propertyTitle: lead.property?.title ?? "General inquiry",
      when: formatDate(lead.createdAt, "PPP"),
    })),
    inspections: inspections.map((item) => ({
      id: item.id,
      name: item.fullName,
      phone: item.phone,
      status: item.status.replaceAll("_", " "),
      propertyTitle: item.property?.title ?? "Property",
      when: formatDate(item.scheduledFor, "PPP"),
    })),
  };
}
