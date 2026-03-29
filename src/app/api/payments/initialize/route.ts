import { requireTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { ok, fail } from "@/lib/http";
import { initializePayment } from "@/lib/payments/paystack";
import { persistInitializedPayment } from "@/lib/payments/reconciliation";
import { namespacePaymentReference } from "@/lib/payments/references";
import { paymentInitializeSchema } from "@/lib/validations/payments";
import { buildSettlementQuote, requireCompanyPlanAccess } from "@/modules/billing/service";

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

  const body = paymentInitializeSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid payment initialization payload.");
  }

  try {
    await requireCompanyPlanAccess(tenant, "TRANSACTIONS");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "An active company plan is required.",
      402,
    );
  }

  let settlementQuote:
    | Awaited<ReturnType<typeof buildSettlementQuote>>
    | null = null;

  if (tenant.companyId) {
    settlementQuote = await buildSettlementQuote({
      companyId: tenant.companyId,
      amount: body.data.amount,
      currency: "NGN",
    });

    if (settlementQuote.provider !== "PAYSTACK") {
      return fail(
        "The configured transaction payment provider is not yet available for live checkout in this environment.",
        400,
      );
    }

    if (settlementQuote.settlement.ready === false) {
      return fail(settlementQuote.settlement.reason, 400);
    }
  }

  const payment = await initializePayment({
    ...body.data,
    reference: namespacePaymentReference(tenant, body.data.reference),
    splitConfig:
      settlementQuote?.settlement.ready && settlementQuote.settlement.providerPayload.paystack
        ? {
            subaccount: String(settlementQuote.settlement.providerPayload.paystack["subaccount"]),
            transactionCharge: Number(
              settlementQuote.settlement.providerPayload.paystack["transaction_charge"] ?? 0,
            ) / 100,
            bearer: String(
              settlementQuote.settlement.providerPayload.paystack["bearer"] ?? "subaccount",
            ),
          }
        : undefined,
    metadata: {
      ...body.data.metadata,
      companyId: tenant.companyId,
      companySlug: tenant.companySlug,
      userId: tenant.userId,
      installmentId: body.data.installmentId,
      marketerId: body.data.marketerId,
      settlementQuote: settlementQuote
        ? {
            provider: settlementQuote.provider,
            breakdown: settlementQuote.breakdown,
            ruleId: settlementQuote.commissionRule.id ?? null,
          }
        : undefined,
    },
  });

  if (tenant.companyId && tenant.userId) {
    await persistInitializedPayment({
      ...body.data,
      reference: payment.reference,
      companyId: tenant.companyId,
      userId: tenant.userId,
      transactionId: body.data.transactionId,
      installmentId: body.data.installmentId,
      marketerId: body.data.marketerId,
      reservationReference: body.data.reservationReference,
      metadata: {
        ...body.data.metadata,
        companyId: tenant.companyId,
        companySlug: tenant.companySlug,
        userId: tenant.userId,
        installmentId: body.data.installmentId,
        marketerId: body.data.marketerId,
        settlementQuote: settlementQuote
          ? {
              provider: settlementQuote.provider,
              breakdown: settlementQuote.breakdown,
              ruleId: settlementQuote.commissionRule.id ?? null,
            }
          : undefined,
      },
    });
  }

  return ok(payment, { status: 201 });
}
