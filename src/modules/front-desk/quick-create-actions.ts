"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { createInquiry } from "@/modules/inquiries/service";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";

export type QuickFormState = { ok: boolean; error: string | null };


function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: FormDataEntryValue | null): string | null {
  const v = str(value);
  return v.length > 0 ? v : null;
}

/** Create a walk-in visitor from the quick-add modal. */
export async function createVisitorQuick(
  _prev: QuickFormState,
  formData: FormData,
): Promise<QuickFormState> {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/visitors"));
  if (!tenant.companyId) return { ok: false, error: "No active company." };

  const fullName = str(formData.get("fullName"));
  if (fullName.length < 2) return { ok: false, error: "Enter the visitor's name." };

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
    revalidatePath("/admin/visitors");
    revalidatePath("/admin/front-desk");
    return { ok: true, error: null };
  } catch (error) {
    logError("Quick visitor create failed.", {
      route: "/admin/visitors",
      companyId: tenant.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return { ok: false, error: "Could not log the visitor. Please try again." };
  }
}

/** Create a lead/inquiry from the quick-add modal. Reuses createInquiry so the
 *  company's operators get the usual INQUIRY_RECEIVED notification. */
export async function createLeadQuick(
  _prev: QuickFormState,
  formData: FormData,
): Promise<QuickFormState> {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/leads"));
  if (!tenant.companyId) return { ok: false, error: "No active company." };

  try {
    await createInquiry(tenant, {
      fullName: str(formData.get("fullName")),
      email: str(formData.get("email")),
      phone: optional(formData.get("phone")) ?? undefined,
      message: str(formData.get("message")),
      source: "WALK_IN",
    });
    revalidatePath("/admin/leads");
    revalidatePath("/admin/front-desk");
    return { ok: true, error: null };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const friendly = /email/i.test(raw)
      ? "Enter a valid email address."
      : /message/i.test(raw)
        ? "The note must be at least 10 characters."
        : /fullName|at least 2|min/i.test(raw)
          ? "Enter the full name (at least 2 characters)."
          : "Could not save the lead. Check the fields and try again.";
    logError("Quick lead create failed.", {
      route: "/admin/leads",
      companyId: tenant.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return { ok: false, error: friendly };
  }
}
