import { Prisma } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import {
  createPaystackSubaccount,
  updatePaystackSubaccount,
} from "@/lib/payments/paystack";
import { paymentAccountSchema } from "@/lib/validations/payment-account";

// ─── GET — fetch existing account ────────────────────────────────────────────

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return ok({ account: null });
  }

  const account = await prisma.companyPaymentProviderAccount.findFirst({
    where: { companyId: tenant.companyId, provider: "PAYSTACK" },
    orderBy: { createdAt: "desc" },
  });

  return ok({ account });
}

// ─── POST — create subaccount ─────────────────────────────────────────────────

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  const existing = await prisma.companyPaymentProviderAccount.findFirst({
    where: { companyId: tenant.companyId, provider: "PAYSTACK" },
    select: { id: true },
  });
  if (existing) {
    return fail("A Paystack account is already connected. Use PATCH to update it.", 409);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const body = paymentAccountSchema.safeParse(json);
  if (!body.success) {
    return fail(body.error.issues[0]?.message ?? "Invalid input.", 400);
  }

  try {
    const result = await createPaystackSubaccount({
      businessName: body.data.businessName,
      settlementBank: body.data.settlementBank,
      accountNumber: body.data.accountNumber,
      percentageCharge: body.data.percentageCharge,
    });

    const account = await prisma.companyPaymentProviderAccount.create({
      data: {
        companyId: tenant.companyId,
        provider: "PAYSTACK",
        displayName: result.businessName,
        accountReference: result.accountNumber,
        subaccountCode: result.subaccountCode,
        status: result.isVerified ? "ACTIVE" : "PENDING",
        isDefaultPayout: true,
        settlementCurrency: "NGN",
        settlementCountry: "NG",
        metadata: {
          bankCode: body.data.settlementBank,
          bankName: result.bankName,
          businessName: result.businessName,
          accountNumber: result.accountNumber,
          percentageCharge: result.percentageCharge,
          isVerified: result.isVerified,
        } as Prisma.InputJsonValue,
      },
    });

    return ok({ account }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to create subaccount.", 400);
  }
}

// ─── PATCH — update existing subaccount ───────────────────────────────────────

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  const existing = await prisma.companyPaymentProviderAccount.findFirst({
    where: { companyId: tenant.companyId, provider: "PAYSTACK" },
  });
  if (!existing?.subaccountCode) {
    return fail("No Paystack subaccount found. Use POST to create one.", 404);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const body = paymentAccountSchema.safeParse(json);
  if (!body.success) {
    return fail(body.error.issues[0]?.message ?? "Invalid input.", 400);
  }

  try {
    const result = await updatePaystackSubaccount(existing.subaccountCode, {
      businessName: body.data.businessName,
      settlementBank: body.data.settlementBank,
      accountNumber: body.data.accountNumber,
      percentageCharge: body.data.percentageCharge,
    });

    const account = await prisma.companyPaymentProviderAccount.update({
      where: { id: existing.id },
      data: {
        displayName: result.businessName,
        accountReference: result.accountNumber,
        status: result.isVerified ? "ACTIVE" : "PENDING",
        metadata: {
          bankCode: body.data.settlementBank,
          bankName: result.bankName,
          businessName: result.businessName,
          accountNumber: result.accountNumber,
          percentageCharge: result.percentageCharge,
          isVerified: result.isVerified,
        } as Prisma.InputJsonValue,
      },
    });

    return ok({ account });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to update subaccount.", 400);
  }
}
