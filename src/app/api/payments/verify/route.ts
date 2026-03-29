import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { ok, fail } from "@/lib/http";
import { createReceiptFromPayment, verifyPayment } from "@/lib/payments/paystack";
import { assertPaymentReferenceBelongsToTenant } from "@/lib/payments/references";
import { publishDomainEvent } from "@/lib/notifications/events";
import { requireTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { paymentVerifySchema } from "@/lib/validations/payments";

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

  const verification = await verifyPayment(body.data.reference);
  const receipt = createReceiptFromPayment(body.data.reference, 0);

  await publishDomainEvent("payment/confirmed", {
    reference: body.data.reference,
    status: verification.status,
  });

  await writeAuditLog({
    companyId: tenant.companyId,
    action: "PAYMENT",
    entityType: "Payment",
    entityId: body.data.reference,
    summary: `Payment ${verification.status.toLowerCase()} for ${body.data.reference}`,
    payload: { verification, receipt } as unknown as Prisma.JsonObject,
  });

  return ok({ verification, receipt });
}
