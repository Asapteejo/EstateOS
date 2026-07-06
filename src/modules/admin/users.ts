import type { AppRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { formatDate } from "@/lib/utils";

/** Roles that make a user a company operator (i.e. staff, not a buyer). */
export const OPERATOR_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN", "STAFF", "FINANCE", "LEGAL", "MARKETER"];
/** Owner roles that are protected from suspend/delete by other admins. */
export const OWNER_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN"];
/** Operator roles a CEO may grant/revoke from the Users tab (owner roles excluded). */
export const ASSIGNABLE_ROLES: AppRole[] = ["STAFF", "FINANCE", "LEGAL", "MARKETER"];
/** Display labels for assignable roles. */
export const ROLE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  FINANCE: "Finance",
  LEGAL: "Legal",
  MARKETER: "Marketer",
};

export type CompanyUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isOwner: boolean;
  isSelf: boolean;
  roles: Array<{ name: AppRole; label: string }>;
  title: string | null;
  staffCode: string | null;
  joinedLabel: string;
};

/**
 * All operator (staff) accounts for the owner's company, with their login roles
 * and active status. Buyers are excluded. Degrades to an empty list without a DB.
 */
export async function getCompanyUsers(context: TenantContext): Promise<CompanyUserRow[]> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { companyId: context.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      roles: { select: { role: { select: { name: true, label: true } } } },
      staffProfile: { select: { title: true, staffCode: true } },
    },
  });

  return users
    .map((user) => {
      const roles = user.roles.map((entry) => ({
        name: entry.role.name,
        label: entry.role.label,
      }));
      return {
        id: user.id,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
        email: user.email,
        phone: user.phone,
        isActive: user.isActive,
        isOwner: roles.some((role) => OWNER_ROLES.includes(role.name)),
        isSelf: context.userId === user.id,
        roles,
        title: user.staffProfile?.title ?? null,
        staffCode: user.staffProfile?.staffCode ?? null,
        joinedLabel: formatDate(user.createdAt, "PPP"),
      };
    })
    .filter((user) => user.roles.some((role) => OPERATOR_ROLES.includes(role.name)));
}
