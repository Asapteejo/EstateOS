"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSuperAdminSession } from "@/lib/auth/guards";
import {
  superadminCompanyOnboardingSchema,
  superadminSubscriptionOverrideSchema,
} from "@/lib/validations/superadmin";
import {
  createCompanyFromSuperadmin,
  createMockCompanyFromSuperadmin,
  overrideCompanySubscriptionFromSuperadmin,
} from "@/modules/superadmin/onboarding";
import { updatePlatformCommissionFromSuperadmin } from "@/modules/superadmin/commission";

const platformCommissionSchema = z.object({
  companyId: z.string().min(1),
  commissionPercentage: z.coerce.number().min(0).max(100).optional(),
  fixedFee: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  if ((value.commissionPercentage ?? 0) <= 0 && (value.fixedFee ?? 0) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["commissionPercentage"],
      message: "Set either a commission percentage or a fixed fee.",
    });
  }
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function errorRedirect(pathname: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${pathname}?error=${encodeURIComponent(message)}`);
}

export async function createSuperadminCompanyAction(formData: FormData) {
  let redirectTo = "/superadmin/companies/new";

  try {
    const context = await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const input = superadminCompanyOnboardingSchema.parse({
      companyName: formValue(formData, "companyName"),
      slug: formValue(formData, "slug"),
      contactEmail: formValue(formData, "contactEmail"),
      contactPhone: formValue(formData, "contactPhone"),
      ownerFirstName: formValue(formData, "ownerFirstName"),
      ownerLastName: formValue(formData, "ownerLastName"),
      ownerEmail: formValue(formData, "ownerEmail"),
      plan: formValue(formData, "plan"),
      billingMode: formValue(formData, "billingMode"),
      accessStatus: formValue(formData, "accessStatus"),
      subscriptionEndsAt: formValue(formData, "subscriptionEndsAt"),
      internalNote: formValue(formData, "internalNote"),
    });

    const result = await createCompanyFromSuperadmin(context, input);
    revalidatePath("/superadmin/companies");
    redirectTo = `/superadmin/companies/${result.companyId}?created=1`;
  } catch (error) {
    errorRedirect("/superadmin/companies/new", error);
  }

  redirect(redirectTo);
}

export async function overrideSuperadminSubscriptionAction(formData: FormData) {
  const companyId = formValue(formData, "companyId") ?? "";

  try {
    const context = await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const input = superadminSubscriptionOverrideSchema.parse({
      companyId,
      plan: formValue(formData, "plan"),
      billingMode: formValue(formData, "billingMode"),
      accessStatus: formValue(formData, "accessStatus"),
      subscriptionEndsAt: formValue(formData, "subscriptionEndsAt"),
      lifetimeInternalTest: formData.get("lifetimeInternalTest") === "on",
      internalNote: formValue(formData, "internalNote"),
    });

    await overrideCompanySubscriptionFromSuperadmin(context, input);
    revalidatePath("/superadmin/companies");
    revalidatePath(`/superadmin/companies/${companyId}`);
  } catch (error) {
    errorRedirect(`/superadmin/companies/${companyId}`, error);
  }

  redirect(`/superadmin/companies/${companyId}?subscription=updated`);
}

export async function createMockCompanyAction() {
  let redirectTo = "/superadmin/companies/new";

  try {
    const context = await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const result = await createMockCompanyFromSuperadmin(context);
    revalidatePath("/superadmin/companies");
    redirectTo = `/superadmin/companies/${result.companyId}?mock=created`;
  } catch (error) {
    errorRedirect("/superadmin/companies/new", error);
  }

  redirect(redirectTo);
}

export async function updatePlatformCommissionAction(formData: FormData) {
  const companyId = formValue(formData, "companyId") ?? "";

  try {
    const context = await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const input = platformCommissionSchema.parse({
      companyId,
      commissionPercentage: formValue(formData, "commissionPercentage") || "0",
      fixedFee: formValue(formData, "fixedFee") || "0",
      notes: formValue(formData, "notes"),
    });

    await updatePlatformCommissionFromSuperadmin(context, input);
    revalidatePath("/superadmin/companies");
    revalidatePath(`/superadmin/companies/${companyId}`);
  } catch (error) {
    errorRedirect(`/superadmin/companies/${companyId}`, error);
  }

  redirect(`/superadmin/companies/${companyId}?commission=updated`);
}
