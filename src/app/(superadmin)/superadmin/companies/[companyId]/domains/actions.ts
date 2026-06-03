"use server";

import { redirect } from "next/navigation";

import { requireSuperAdminSession } from "@/lib/auth/guards";
import {
  markCompanyCustomDomainSkipped,
  removeCompanyCustomDomain,
  setCompanyCustomDomain,
  verifyCompanyCustomDomain,
} from "@/modules/domains/service";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function resultUrl(companyId: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/superadmin/companies/${companyId}/domains?${search.toString()}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update custom domain.";
}

export async function setSuperadminCompanyDomainAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const companyId = readString(formData, "companyId");
  const customDomain = readString(formData, "customDomain");
  let target = resultUrl(companyId, { status: "updated" });

  try {
    await setCompanyCustomDomain({
      companyId,
      customDomain,
      actor: { userId: session.userId, source: "superadmin" },
    });
  } catch (error) {
    target = resultUrl(companyId, { error: errorMessage(error) });
  }

  redirect(target);
}

export async function verifySuperadminCompanyDomainAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const companyId = readString(formData, "companyId");
  let target = resultUrl(companyId, { status: "verified" });

  try {
    const result = await verifyCompanyCustomDomain({
      companyId,
      actor: { userId: session.userId, source: "superadmin" },
    });
    target = resultUrl(companyId, result.verified ? { status: "verified" } : { error: result.reason ?? "Domain verification failed." });
  } catch (error) {
    target = resultUrl(companyId, { error: errorMessage(error) });
  }

  redirect(target);
}

export async function skipSuperadminCompanyDomainAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const companyId = readString(formData, "companyId");
  let target = resultUrl(companyId, { status: "skipped" });

  try {
    await markCompanyCustomDomainSkipped({
      companyId,
      actor: { userId: session.userId, source: "superadmin" },
    });
  } catch (error) {
    target = resultUrl(companyId, { error: errorMessage(error) });
  }

  redirect(target);
}

export async function removeSuperadminCompanyDomainAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const companyId = readString(formData, "companyId");
  const confirmation = readString(formData, "confirmation");
  let target = resultUrl(companyId, { status: "removed" });

  try {
    await removeCompanyCustomDomain({
      companyId,
      confirmation,
      actor: { userId: session.userId, source: "superadmin" },
    });
  } catch (error) {
    target = resultUrl(companyId, { error: errorMessage(error) });
  }

  redirect(target);
}
