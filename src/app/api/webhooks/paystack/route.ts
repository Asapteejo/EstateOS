import { ok, fail } from "@/lib/http";
import { captureServerException } from "@/lib/integrations/posthog";
import { reconcilePaystackWebhook } from "@/lib/payments/reconciliation";
import { verifyPaystackSignature } from "@/lib/payments/paystack";
import { logError, logWarn } from "@/lib/ops/logger";
import { captureException } from "@/lib/sentry";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    logWarn("Paystack webhook rejected due to invalid signature.", {
      hasSignature: Boolean(signature),
    });
    return fail("Invalid webhook signature.", 401);
  }

  try {
    const reconciliation = await reconcilePaystackWebhook(
      JSON.parse(rawBody) as Parameters<typeof reconcilePaystackWebhook>[0],
    );
    return ok(reconciliation);
  } catch (error) {
    await captureServerException(error, {
      source: "webhook",
      route: "/api/webhooks/paystack",
      method: "POST",
      area: "api",
      requestId: request.headers.get("x-vercel-id"),
      statusCode: 500,
    }, {
      severity: "HIGH",
    });
    captureException(error);
    logError("Paystack webhook reconciliation failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return fail(
      error instanceof Error ? error.message : "Failed to reconcile webhook.",
      400,
    );
  }
}
