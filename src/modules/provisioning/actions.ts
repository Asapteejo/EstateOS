"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { adminMutationRateLimit } from "@/lib/rate-limit";
import {
  provisionCompanyUser,
  type BuyerProfileInput,
  type StaffProfileInput,
  type ProvisionUserResult,
} from "@/modules/provisioning/provision-user";
import type { AppRole } from "@prisma/client";

// ─── Front-desk: BUYER only ───────────────────────────────────────────────────

export type AddBuyerFormData = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  delivery: "invite" | "password";
  buyerProfile?: BuyerProfileInput;
};

export async function provisionBuyerAction(
  _prevState: ProvisionUserResult | null,
  formData: FormData,
): Promise<ProvisionUserResult> {
  const session = await requireAdminSession(rolesForAdminPath("/admin/front-desk"));
  const { companyId: buyerCompanyId, userId: buyerActorId } = session;
  if (!buyerCompanyId) return { ok: false, error: "No company context." };
  if (!buyerActorId) return { ok: false, error: "No user context." };

  if (adminMutationRateLimit) {
    const { success } = await adminMutationRateLimit.limit(`provision:${buyerActorId}`);
    if (!success) return { ok: false, error: "Too many requests. Please wait a moment." };
  }

  const result = await provisionCompanyUser({
    companyId: buyerCompanyId,
    actorUserId: buyerActorId,
    actorRoles: session.roles,
    role: "BUYER",
    email: String(formData.get("email") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: formData.get("phone") ? String(formData.get("phone")) : null,
    delivery: formData.get("delivery") === "password" ? "password" : "invite",
    buyerProfile: {
      addressLine1: formData.get("addressLine1") ? String(formData.get("addressLine1")) : null,
      addressLine2: formData.get("addressLine2") ? String(formData.get("addressLine2")) : null,
      city: formData.get("city") ? String(formData.get("city")) : null,
      state: formData.get("state") ? String(formData.get("state")) : null,
      country: formData.get("country") ? String(formData.get("country")) : null,
      occupation: formData.get("occupation") ? String(formData.get("occupation")) : null,
      nextOfKinName: formData.get("nextOfKinName") ? String(formData.get("nextOfKinName")) : null,
      nextOfKinPhone: formData.get("nextOfKinPhone") ? String(formData.get("nextOfKinPhone")) : null,
    },
  });

  if (result.ok) revalidatePath("/admin/front-desk");
  return result;
}

// ─── CEO: any provisionable role ──────────────────────────────────────────────

export type AddPersonFormData = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: AppRole;
  delivery: "invite" | "password";
  staffProfile?: StaffProfileInput;
  buyerProfile?: BuyerProfileInput;
};

export async function provisionPersonAction(
  _prevState: ProvisionUserResult | null,
  formData: FormData,
): Promise<ProvisionUserResult> {
  const session = await requireAdminSession(rolesForAdminPath("/admin/users"));
  const { companyId: personCompanyId, userId: personActorId } = session;
  if (!personCompanyId) return { ok: false, error: "No company context." };
  if (!personActorId) return { ok: false, error: "No user context." };

  if (adminMutationRateLimit) {
    const { success } = await adminMutationRateLimit.limit(`provision:${personActorId}`);
    if (!success) return { ok: false, error: "Too many requests. Please wait a moment." };
  }

  const role = String(formData.get("role") ?? "") as AppRole;

  const result = await provisionCompanyUser({
    companyId: personCompanyId,
    actorUserId: personActorId,
    actorRoles: session.roles,
    role,
    email: String(formData.get("email") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: formData.get("phone") ? String(formData.get("phone")) : null,
    delivery: formData.get("delivery") === "password" ? "password" : "invite",
    staffProfile:
      role !== "BUYER"
        ? {
            title: formData.get("title") ? String(formData.get("title")) : null,
            staffCode: formData.get("staffCode") ? String(formData.get("staffCode")) : null,
          }
        : undefined,
    buyerProfile:
      role === "BUYER"
        ? {
            addressLine1: formData.get("addressLine1") ? String(formData.get("addressLine1")) : null,
            city: formData.get("city") ? String(formData.get("city")) : null,
            state: formData.get("state") ? String(formData.get("state")) : null,
            country: formData.get("country") ? String(formData.get("country")) : null,
            occupation: formData.get("occupation") ? String(formData.get("occupation")) : null,
          }
        : undefined,
  });

  if (result.ok) revalidatePath("/admin/users");
  return result;
}
