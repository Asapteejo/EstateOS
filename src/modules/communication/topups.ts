import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { initializePayment, verifyPayment } from "@/lib/payments/paystack";
import { namespacePaymentReference, parseTenantPaymentReference } from "@/lib/payments/references";
import type { TenantContext } from "@/lib/tenancy/context";
import { getCreditsFromAmount } from "@/modules/communication/pricing";
import { recordTopUp } from "@/modules/communication/wallet";

export const COMMUNICATION_TOP_UP_TYPE = "WHATSAPP_TOPUP";

export type CommunicationTopUpMetadata = {
  type: typeof COMMUNICATION_TOP_UP_TYPE;
  companyId: string;
  companySlug: string | null;
  creditsExpected: number;
};

export function normalizeTopUpAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Top-up amount must be greater than zero.");
  }

  return Math.round(amount);
}

export function buildCommunicationTopUpReference() {
  return `WATOP_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

export function isCommunicationTopUpMetadata(
  metadata: Record<string, unknown> | null | undefined,
): metadata is CommunicationTopUpMetadata {
  return metadata?.["type"] === COMMUNICATION_TOP_UP_TYPE;
}

export async function initializeCommunicationTopUp(input: {
  tenant: TenantContext;
  amountNGN: number;
}) {
  if (!featureFlags.hasPaystack || !featureFlags.hasDatabase) {
    throw new Error("Paystack is not configured for WhatsApp credit top-ups.");
  }

  if (!input.tenant.companyId) {
    throw new Error("Tenant company context is required.");
  }

  const amount = normalizeTopUpAmount(input.amountNGN);
  const creditsExpected = getCreditsFromAmount(amount);
  const company = await prisma.company.findUnique({
    where: { id: input.tenant.companyId },
    select: {
      id: true,
      slug: true,
      name: true,
      users: {
        where: { id: input.tenant.userId ?? "__missing_user__" },
        select: { email: true },
        take: 1,
      },
    },
  });

  if (!company) {
    throw new Error("Tenant company was not found.");
  }

  const email = company.users?.[0]?.email;
  if (!email) {
    throw new Error("A tenant admin email is required to initialize top-up checkout.");
  }

  const reference = namespacePaymentReference(input.tenant, buildCommunicationTopUpReference());
  const metadata: CommunicationTopUpMetadata = {
    type: COMMUNICATION_TOP_UP_TYPE,
    companyId: company.id,
    companySlug: company.slug,
    creditsExpected,
  };

  const payment = await initializePayment({
    email,
    amount,
    currency: "NGN",
    reference,
    callbackUrl: `${env.APP_BASE_URL}/admin/settings?walletTopUp=pending`,
    metadata,
    channels: ["card", "bank", "ussd"],
  });

  await prisma.communicationTopUp.upsert({
    where: {
      companyId_providerReference: {
        companyId: company.id,
        providerReference: payment.reference,
      },
    },
    update: {
      amountPaid: amount,
      creditsPurchased: creditsExpected,
      currency: "NGN",
      status: "PENDING",
      metadata: metadata as unknown as Prisma.InputJsonValue,
    },
    create: {
      companyId: company.id,
      provider: "PAYSTACK",
      providerReference: payment.reference,
      amountPaid: amount,
      creditsPurchased: creditsExpected,
      currency: "NGN",
      status: "PENDING",
      metadata: metadata as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    ...payment,
    creditsExpected,
    amount,
  };
}

export async function reconcileCommunicationTopUpWebhook(input: {
  reference: string;
  companyId: string;
  rawAmountKobo?: number;
  metadata?: Record<string, unknown>;
  payload: Prisma.InputJsonValue;
}) {
  const verification = await verifyPayment(input.reference);
  if (verification.status !== "SUCCESS") {
    return {
      credited: false,
      status: verification.status,
    };
  }

  const amountNGN = normalizeTopUpAmount((input.rawAmountKobo ?? 0) / 100);
  const creditsPurchased = getCreditsFromAmount(amountNGN);
  const parsed = parseTenantPaymentReference(input.reference);

  if (!parsed) {
    throw new Error("Communication top-up reference is not tenant-scoped.");
  }

  return recordTopUp({
    companyId: input.companyId,
    amountPaid: amountNGN,
    currency: "NGN",
    creditsPurchased,
    providerReference: input.reference,
    metadata: {
      ...(input.metadata ?? {}),
      provider: "PAYSTACK",
      type: COMMUNICATION_TOP_UP_TYPE,
      amountNGN,
      rawReference: parsed.rawReference,
      providerPayload: input.payload,
    } as Prisma.InputJsonValue,
  });
}
