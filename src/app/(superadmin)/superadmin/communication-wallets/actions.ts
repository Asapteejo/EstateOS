"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSuperAdminSession } from "@/lib/auth/guards";
import { adjustCompanyWallet } from "@/modules/communication/wallet";

const walletAdjustmentSchema = z.object({
  companyId: z.string().trim().min(1),
  amount: z.coerce.number().int().refine((value) => value !== 0, {
    message: "Amount must be a non-zero integer.",
  }),
  type: z.enum(["TOP_UP", "ADJUSTMENT"]),
  reference: z.string().trim().max(240).optional(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function errorRedirect(companyId: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Unable to adjust wallet.";
  redirect(`/superadmin/communication-wallets/${companyId}?error=${encodeURIComponent(message)}`);
}

export async function adjustCommunicationWalletAction(formData: FormData) {
  const companyId = formValue(formData, "companyId") ?? "";

  try {
    await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const input = walletAdjustmentSchema.parse({
      companyId,
      amount: formValue(formData, "amount"),
      type: formValue(formData, "type"),
      reference: formValue(formData, "reference"),
    });

    await adjustCompanyWallet({
      companyId: input.companyId,
      amount: input.amount,
      type: input.type,
      reference: input.reference || null,
      metadata: {
        source: "superadmin_manual_adjustment",
      },
    });

    revalidatePath("/superadmin/communication-wallets");
    revalidatePath(`/superadmin/communication-wallets/${input.companyId}`);
  } catch (error) {
    errorRedirect(companyId, error);
  }

  redirect(`/superadmin/communication-wallets/${companyId}?adjusted=1`);
}
