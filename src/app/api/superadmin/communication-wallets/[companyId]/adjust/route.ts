import { z } from "zod";

import { isSuperadminAccessError, requireSuperAdminSession } from "@/lib/auth/guards";
import { fail, ok, validationFail } from "@/lib/http";
import { adjustCompanyWallet } from "@/modules/communication/wallet";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

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
    const session = await requireSuperAdminSession({ redirectOnMissingAuth: false });

    const rateLimited = await enforceRateLimit(
      adminMutationRateLimit,
      [`ip:${getClientIp(request)}`, `user:${session.userId ?? "superadmin"}`],
      "Too many requests. Please slow down and try again.",
    );
    if (rateLimited) return rateLimited;

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
