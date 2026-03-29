import { ok, fail } from "@/lib/http";
import { reconcilePaystackWebhook } from "@/lib/payments/reconciliation";
import { verifyPaystackSignature } from "@/lib/payments/paystack";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    return fail("Invalid webhook signature.", 401);
  }

  try {
    const reconciliation = await reconcilePaystackWebhook(
      JSON.parse(rawBody) as Parameters<typeof reconcilePaystackWebhook>[0],
    );
    return ok(reconciliation);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to reconcile webhook.",
      400,
    );
  }
}
