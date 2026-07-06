"use server";

import type { AppRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { ASSIGNABLE_ROLES, OWNER_ROLES, ROLE_LABELS } from "@/modules/admin/users";

const PATH = "/admin/users";

export type UserActionResult = { ok: boolean; error?: string };

async function loadTargetUser(companyId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, roles: { select: { role: { select: { name: true } } } } },
  });
}

function isOwner(roles: Array<{ role: { name: AppRole } }>) {
  return roles.some((entry) => OWNER_ROLES.includes(entry.role.name));
}

/** Suspend or reactivate a staff account. Owners and self are protected. */
export async function setUserActiveAction(userId: string, isActive: boolean): Promise<UserActionResult> {
  const tenant = await requireAdminSession(rolesForAdminPath(PATH));
  if (!tenant.companyId) return { ok: false, error: "No company context." };
  if (userId === tenant.userId) return { ok: false, error: "You cannot change your own status." };

  const target = await loadTargetUser(tenant.companyId, userId);
  if (!target) return { ok: false, error: "User not found in your company." };
  if (!isActive && isOwner(target.roles)) return { ok: false, error: "Owner accounts cannot be suspended." };

  await prisma.user.update({ where: { id: target.id }, data: { isActive } });
  revalidatePath(PATH);
  return { ok: true };
}

/** Grant or revoke an operator role for a staff account. Owner roles and self are protected. */
export async function setUserRoleAction(
  userId: string,
  roleName: AppRole,
  grant: boolean,
): Promise<UserActionResult> {
  const tenant = await requireAdminSession(rolesForAdminPath(PATH));
  if (!tenant.companyId) return { ok: false, error: "No company context." };
  if (userId === tenant.userId) return { ok: false, error: "You cannot change your own roles." };
  if (!ASSIGNABLE_ROLES.includes(roleName)) {
    return { ok: false, error: "That role cannot be changed here." };
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: tenant.companyId },
    select: { id: true },
  });
  if (!target) return { ok: false, error: "User not found in your company." };

  const role =
    (await prisma.role.findFirst({
      where: { companyId: tenant.companyId, name: roleName },
      select: { id: true },
    })) ??
    (await prisma.role.create({
      data: { companyId: tenant.companyId, name: roleName, label: ROLE_LABELS[roleName] ?? roleName },
      select: { id: true },
    }));

  if (grant) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: target.id, roleId: role.id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: target.id, roleId: role.id, companyId: tenant.companyId },
      });
    }
    // A marketer needs a StaffProfile to be assignable and to see their dashboard.
    if (roleName === "MARKETER") {
      await prisma.staffProfile.upsert({
        where: { userId: target.id },
        update: { isAssignable: true },
        create: { userId: target.id, isAssignable: true, title: "Marketer" },
      });
    }
  } else {
    await prisma.userRole.deleteMany({
      where: { userId: target.id, roleId: role.id, companyId: tenant.companyId },
    });
  }

  revalidatePath(PATH);
  return { ok: true };
}

/** Permanently delete a staff account. Owners and self are protected. */
export async function deleteUserAction(userId: string): Promise<UserActionResult> {
  const tenant = await requireAdminSession(rolesForAdminPath(PATH));
  if (!tenant.companyId) return { ok: false, error: "No company context." };
  if (userId === tenant.userId) return { ok: false, error: "You cannot delete your own account." };

  const target = await loadTargetUser(tenant.companyId, userId);
  if (!target) return { ok: false, error: "User not found in your company." };
  if (isOwner(target.roles)) return { ok: false, error: "Owner accounts cannot be deleted here." };

  await prisma.user.delete({ where: { id: target.id } });
  revalidatePath(PATH);
  return { ok: true };
}
