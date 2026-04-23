import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { ok, fail } from "@/lib/http";
import { captureServerException } from "@/lib/integrations/posthog";
import { verifyPayment } from "@/lib/payments/paystack";
import { assertPaymentReferenceBelongsToTenant } from "@/lib/payments/references";
import { requireTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { paymentVerifySchema } from "@/lib/validations/payments";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("portal", { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const json = (await request.json()) as Record<string, unknown>;
  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = paymentVerifySchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid payment verification payload.");
  }

  try {
    assertPaymentReferenceBelongsToTenant(tenant, body.data.reference);
  } catch {
    return fail("Payment reference is not valid for this tenant.", 403);
  }

  try {
    const localPayment =
      featureFlags.hasDatabase && tenant.companyId
        ? await prisma.payment.findUnique({
            where: {
              companyId_providerReference: {
                companyId: tenant.companyId,
                providerReference: body.data.reference,
              },
            },
            select: {
              id: true,
              userId: true,
              status: true,
              paidAt: true,
              receipt: {
                select: {
                  id: true,
                  receiptNumber: true,
                },
              },
            },
          })
        : null;

    if (featureFlags.hasDatabase && tenant.companyId) {
      if (!localPayment) {
        return fail("Payment not found for this buyer.", 404);
      }

      if (localPayment.userId && localPayment.userId !== tenant.userId) {
        return fail("Payment not found for this buyer.", 404);
      }
    }

    const verification = await verifyPayment(body.data.reference);

    return ok({
      verification,
      payment: localPayment,
      authoritativeSource: "webhook",
      message:
        verification.status === "SUCCESS" && localPayment?.status !== "SUCCESS"
          ? "Provider reports success, but local records will remain authoritative only after webhook reconciliation."
          : "Verification completed.",
    });
  } catch (error) {
    await captureServerException(error, {
      source: "payment",
      route: "/api/payments/verify",
      method: "POST",
      companyId: tenant.companyId,
      companySlug: tenant.companySlug,
      userId: tenant.userId,
      area: "portal",
      requestId: request.headers.get("x-vercel-id"),
      statusCode: 500,
    }, {
      severity: "HIGH",
    });
    return fail(error instanceof Error ? error.message : "Unable to verify payment.", 400);
  }
}
