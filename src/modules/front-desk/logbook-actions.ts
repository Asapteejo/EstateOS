"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";

const LOG_PATH = "/admin/visitors";

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: FormDataEntryValue | null): string | null {
  const v = str(value);
  return v.length > 0 ? v : null;
}

export async function logVisitorAction(formData: FormData): Promise<void> {
  const tenant = await requireAdminSession(rolesForAdminPath(LOG_PATH));
  if (!tenant.companyId) return;

  const fullName = str(formData.get("fullName"));
  if (!fullName) return;

  try {
    await prisma.visitor.create({
      data: {
        companyId: tenant.companyId,
        branchId: tenant.branchId ?? null,
        fullName,
        phone: optional(formData.get("phone")),
        purpose: optional(formData.get("purpose")),
        hostName: optional(formData.get("hostName")),
        loggedById: tenant.userId ?? null,
      },
    });
    revalidatePath(LOG_PATH);
  } catch (error) {
    logError("Log visitor failed (migration pending?).", {
      route: LOG_PATH,
      companyId: tenant.companyId,
      ...buildSafeErrorLogContext(error),
    });
  }
}

export async function checkOutVisitorAction(formData: FormData): Promise<void> {
  const tenant = await requireAdminSession(rolesForAdminPath(LOG_PATH));
  if (!tenant.companyId) return;

  const id = str(formData.get("visitorId"));
  if (!id) return;

  try {
    await prisma.visitor.updateMany({
      where: { id, companyId: tenant.companyId, status: "CHECKED_IN" },
      data: { status: "CHECKED_OUT", checkedOutAt: new Date() },
    });
    revalidatePath(LOG_PATH);
  } catch (error) {
    logError("Visitor check-out failed (migration pending?).", {
      route: LOG_PATH,
      companyId: tenant.companyId,
      ...buildSafeErrorLogContext(error),
    });
  }
}

export async function logCallAction(formData: FormData): Promise<void> {
  const tenant = await requireAdminSession(rolesForAdminPath(LOG_PATH));
  if (!tenant.companyId) return;

  const callerName = str(formData.get("callerName"));
  if (!callerName) return;

  const directionRaw = str(formData.get("direction"));
  const direction = directionRaw === "OUTBOUND" ? "OUTBOUND" : "INBOUND";

  try {
    await prisma.callLog.create({
      data: {
        companyId: tenant.companyId,
        branchId: tenant.branchId ?? null,
        callerName,
        phone: optional(formData.get("phone")),
        direction,
        purpose: optional(formData.get("purpose")),
        outcome: optional(formData.get("outcome")),
        loggedById: tenant.userId ?? null,
      },
    });
    revalidatePath(LOG_PATH);
  } catch (error) {
    logError("Log call failed (migration pending?).", {
      route: LOG_PATH,
      companyId: tenant.companyId,
      ...buildSafeErrorLogContext(error),
    });
  }
}
