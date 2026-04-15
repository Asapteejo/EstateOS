"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/guards";
import {
  createCommissionRule,
  deactivateCommissionRule,
  listCommissionRules,
} from "@/modules/commission/rules";

export async function createCommissionRuleAction(formData: FormData) {
  const tenant = await requireAdminSession(["ADMIN"]);

  const name = (formData.get("name") as string | null)?.trim();
  const feeType = formData.get("feeType") as "FLAT" | "PERCENTAGE" | null;
  const rawFlat = formData.get("flatAmount") as string | null;
  const rawRate = formData.get("percentageRate") as string | null;
  const currency = (formData.get("currency") as string | null)?.trim() || "NGN";
  const propertyType = (formData.get("propertyType") as string | null) || null;
  const propertyId = (formData.get("propertyId") as string | null)?.trim() || null;

  if (!name || !feeType || !["FLAT", "PERCENTAGE"].includes(feeType)) {
    return; // basic guard — real validation happens client-side
  }

  const flatAmount =
    feeType === "FLAT" && rawFlat ? parseFloat(rawFlat) : null;
  const percentageRate =
    feeType === "PERCENTAGE" && rawRate ? parseFloat(rawRate) : null;

  await createCommissionRule({
    companyId: tenant.companyId!,
    name,
    feeType,
    flatAmount,
    percentageRate,
    currency,
    propertyType,
    propertyId,
  });

  revalidatePath("/admin/team/commission-rules");
  redirect("/admin/team/commission-rules");
}

export async function deactivateCommissionRuleAction(formData: FormData) {
  const tenant = await requireAdminSession(["ADMIN"]);

  const id = formData.get("id") as string | null;
  if (!id) return;

  // Verify ownership before deactivating
  const rules = await listCommissionRules(tenant.companyId!);
  if (!rules.some((r) => r.id === id)) return;

  await deactivateCommissionRule(id, tenant.companyId!);
  revalidatePath("/admin/team/commission-rules");
}
