"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guards";
import { toggleMarketplaceListing } from "@/modules/properties/marketplace";

export async function toggleMarketplaceListingAction(formData: FormData) {
  const tenant = await requireAdminSession(["ADMIN"]);

  const propertyId = (formData.get("propertyId") as string | null)?.trim();
  const listed = formData.get("listed") === "true";

  if (!propertyId || !tenant.companyId) return;

  await toggleMarketplaceListing(propertyId, tenant.companyId, listed);
  revalidatePath("/admin/listings/marketplace");
}
