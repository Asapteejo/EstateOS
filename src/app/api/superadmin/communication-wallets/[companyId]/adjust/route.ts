import { z } from "zod";

import { isSuperadminAccessError, requireSuperAdminSession } from "@/lib/auth/guards";
import { fail, ok, validationFail } from "@/lib/http";
import { adjustCompanyWallet } from "@/modules/communication/wallet";

const adjustWalletApiSchema = z.object({
  amount: z.coerce.number().int().refine((value) => value !== 0, {
    message: "Amount must be a non-zero integer.",
  }),
  type: z.enum(["TOP_UP", "ADJUSTMENT"]),
  reference: z.string().trim().max(240).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const { companyId } = await params;
    const parsed = adjustWalletApiSchema.safeParse(await request.json());

    if (!parsed.success) {
      return validationFail(parsed.error);
    }

    const result = await adjustCompanyWallet({
      companyId,
      amount: parsed.data.amount,
      type: parsed.data.type,
      reference: parsed.data.reference || null,
      metadata: {
        source: "superadmin_api_adjustment",
      },
    });

    return ok(result);
  } catch (error) {
    if (isSuperadminAccessError(error)) {
      return fail(error.message, 403);
    }
    return fail(error instanceof Error ? error.message : "Unable to adjust wallet.", 400);
  }
}
