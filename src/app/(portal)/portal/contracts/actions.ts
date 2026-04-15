"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requirePortalSession } from "@/lib/auth/guards";
import { acceptContract } from "@/modules/contracts/service";

export async function acceptContractAction(formData: FormData): Promise<void> {
  const tenant = await requirePortalSession({ redirectOnMissingAuth: false });
  if (!tenant.userId || !tenant.companyId) return;

  const signedAgreementId = (formData.get("signedAgreementId") as string | null)?.trim();
  if (!signedAgreementId) return;

  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : (headersList.get("x-real-ip") ?? "unknown");
  const userAgent = headersList.get("user-agent") ?? "unknown";

  await acceptContract({
    signedAgreementId,
    userId: tenant.userId,
    companyId: tenant.companyId,
    ipAddress,
    userAgent,
  });

  revalidatePath("/portal/contracts");
}
