import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok, validationFail } from "@/lib/http";
import { getCreditsFromAmount } from "@/modules/communication/pricing";
import { initializeCommunicationTopUp } from "@/modules/communication/topups";

const topUpSchema = z.object({
  amountNGN: z.coerce.number().int().positive(),
});

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  const parsed = topUpSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return validationFail(parsed.error);
  }

  try {
    const payment = await initializeCommunicationTopUp({
      tenant,
      amountNGN: parsed.data.amountNGN,
    });

    return ok({
      authorizationUrl: payment.authorizationUrl,
      reference: payment.reference,
      amount: payment.amount,
      creditsExpected: payment.creditsExpected,
    }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to initialize top-up.", 400);
  }
}

export async function GET() {
  return ok({
    pricing: {
      sampleAmountNGN: 100,
      sampleCredits: getCreditsFromAmount(100),
    },
  });
}
