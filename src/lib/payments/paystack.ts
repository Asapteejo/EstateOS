import crypto from "node:crypto";

import type { PaymentStatus } from "@prisma/client";

import { env, featureFlags } from "@/lib/env";
import { logError, logWarn } from "@/lib/ops/logger";

export type PaymentInitializationInput = {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export async function initializePayment(input: PaymentInitializationInput) {
  if (!featureFlags.hasPaystack) {
    logWarn("Paystack initialize called without full Paystack configuration. Returning demo response.");
    return {
      provider: "PAYSTACK",
      authorizationUrl: "#",
      accessCode: "demo-access-code",
      reference: input.reference,
      mode: "demo" as const,
    };
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  if (!response.ok) {
    logError("Paystack initialize request failed.", {
      status: response.status,
    });
    throw new Error("Failed to initialize Paystack payment.");
  }

  const json = (await response.json()) as {
    data: { authorization_url: string; access_code: string; reference: string };
  };

  return {
    provider: "PAYSTACK",
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
    mode: "live" as const,
  };
}

export async function verifyPayment(reference: string) {
  if (!featureFlags.hasPaystack) {
    logWarn("Paystack verify called without full Paystack configuration. Returning demo verification.");
    return {
      status: "SUCCESS" as PaymentStatus,
      reference,
      paidAt: new Date().toISOString(),
      providerPayload: { demo: true, reference },
    };
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  if (!response.ok) {
    logError("Paystack verify request failed.", {
      status: response.status,
      reference,
    });
    throw new Error("Failed to verify Paystack payment.");
  }

  const json = (await response.json()) as {
    data: { status: string; paid_at?: string; reference: string };
  };

  return {
    status: json.data.status === "success" ? ("SUCCESS" as const) : ("FAILED" as const),
    reference: json.data.reference,
    paidAt: json.data.paid_at,
    providerPayload: json,
  };
}

export function verifyPaystackSignature(rawBody: string, signature?: string | null) {
  if (!featureFlags.hasPaystack || !env.PAYSTACK_WEBHOOK_SECRET) {
    logWarn("Paystack webhook signature verification attempted without full Paystack configuration.");
    return false;
  }

  const hash = crypto
    .createHmac("sha512", env.PAYSTACK_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return hash === signature;
}

export function createReceiptFromPayment(reference: string, amount: number) {
  return {
    receiptNumber: `RCT-${reference.toUpperCase()}`,
    totalAmount: amount,
    currency: "NGN",
  };
}
