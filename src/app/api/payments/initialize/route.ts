import { requireTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { ok, fail } from "@/lib/http";
import { initializePayment } from "@/lib/payments/paystack";
import { persistInitializedPayment } from "@/lib/payments/reconciliation";
import { namespacePaymentReference } from "@/lib/payments/references";
import { paymentInitializeSchema } from "@/lib/validations/payments";
import { buildSettlementQuote, requireCompanyPlanAccess } from "@/modules/billing/service";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { getAppSession } from "@/lib/auth/session";
import { resolveBuyerDbUserForKyc } from "@/modules/kyc/buyer-user";
import {
  enforceRateLimit,
  getClientIp,
  paymentInitializeRateLimit,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("portal", { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    paymentInitializeRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "anon"}`],
    "Too many payment attempts. Please wait a moment and try again.",
  );
  if (rateLimited) return rateLimited;

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
  if (featureFlags.isProduction && !body.data.paymentRequestId) {
    return fail("A tenant-issued payment request is required for live checkout.", 400);
  }

  const session = await getAppSession("portal");
  const buyer = await resolveBuyerDbUserForKyc(tenant, {
    email: session?.email,
  }).catch(() => null);
  if (!buyer) {
    return fail("Buyer profile is not initialized for this tenant.", 403);
  }

  const paymentRequest = body.data.paymentRequestId
    ? await prisma.paymentRequest.findFirst({
        where: {
          id: body.data.paymentRequestId,
          companyId: tenant.companyId!,
          userId: buyer.id,
          status: { in: ["SENT", "AWAITING_PAYMENT"] },
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          transactionId: true,
          installmentId: true,
          reservation: { select: { reference: true } },
          user: { select: { email: true } },
        },
      })
    : null;
  if (body.data.paymentRequestId && !paymentRequest) {
    return fail("Payment request not found or no longer payable.", 404);
  }

  const checkout = paymentRequest
    ? {
        email: paymentRequest.user.email,
        amount: paymentRequest.amount.toNumber(),
        currency: paymentRequest.currency,
        reference: `request-${paymentRequest.id}`,
        callbackUrl: `${env.PORTAL_BASE_URL}/portal/payments`,
        paymentRequestId: paymentRequest.id,
        transactionId: paymentRequest.transactionId ?? undefined,
        installmentId: paymentRequest.installmentId ?? undefined,
        reservationReference: paymentRequest.reservation?.reference ?? undefined,
        marketerId: undefined,
        metadata: {
          paymentRequestId: paymentRequest.id,
          source: "TENANT_PAYMENT_REQUEST",
        },
      }
    : {
        email: body.data.email!,
        amount: body.data.amount!,
        currency: body.data.currency,
        reference: body.data.reference!,
        callbackUrl: body.data.callbackUrl!,
        paymentRequestId: undefined,
        transactionId: body.data.transactionId,
        installmentId: body.data.installmentId,
        reservationReference: body.data.reservationReference,
        marketerId: body.data.marketerId,
        metadata: undefined,
      };

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
      amount: checkout.amount,
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
    ...checkout,
    reference: namespacePaymentReference(tenant, checkout.reference),
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
      ...checkout.metadata,
      companyId: tenant.companyId,
      companySlug: tenant.companySlug,
      userId: tenant.userId,
      installmentId: checkout.installmentId,
      marketerId: checkout.marketerId,
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
      ...checkout,
      reference: payment.reference,
      companyId: tenant.companyId,
      userId: buyer.id,
      transactionId: checkout.transactionId,
      paymentRequestId: checkout.paymentRequestId,
      installmentId: checkout.installmentId,
      marketerId: checkout.marketerId,
      reservationReference: checkout.reservationReference,
      metadata: {
        ...checkout.metadata,
        companyId: tenant.companyId,
        companySlug: tenant.companySlug,
        userId: buyer.id,
        installmentId: checkout.installmentId,
        marketerId: checkout.marketerId,
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
