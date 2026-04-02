import crypto from "node:crypto";

import type { PaymentStatus } from "@prisma/client";

import { env, featureFlags } from "@/lib/env";
import { logError, logWarn } from "@/lib/ops/logger";

export type PaymentInitializationInput = {
  email: string;
  amount: number;
  currency?: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  channels?: Array<"bank_transfer" | "card" | "bank" | "ussd">;
  splitConfig?: {
    subaccount?: string;
    transactionCharge?: number;
    bearer?: string;
  };
};

export type PaystackTransferInstructions = {
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  expiresAt: string | null;
};

export function extractTransferInstructions(payload: Record<string, unknown> | null | undefined): PaystackTransferInstructions | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data =
    typeof payload["data"] === "object" && payload["data"] !== null
      ? (payload["data"] as Record<string, unknown>)
      : payload;

  const recipient =
    typeof data["customer"] === "object" && data["customer"] !== null
      ? (data["customer"] as Record<string, unknown>)
      : null;

  const instructions =
    typeof data["transfer_instruction"] === "object" && data["transfer_instruction"] !== null
      ? (data["transfer_instruction"] as Record<string, unknown>)
      : typeof data["authorization"] === "object" && data["authorization"] !== null
        ? (data["authorization"] as Record<string, unknown>)
        : null;

  if (!instructions && !recipient) {
    return null;
  }

  return {
    bankName:
      typeof instructions?.["bank_name"] === "string"
        ? instructions["bank_name"]
        : null,
    accountNumber:
      typeof instructions?.["account_number"] === "string"
        ? instructions["account_number"]
        : null,
    accountName:
      typeof instructions?.["account_name"] === "string"
        ? instructions["account_name"]
        : typeof recipient?.["name"] === "string"
          ? recipient["name"]
          : null,
    expiresAt:
      typeof instructions?.["expiration"] === "string"
        ? instructions["expiration"]
        : typeof instructions?.["expires_at"] === "string"
          ? instructions["expires_at"]
          : null,
  };
}

export async function initializePayment(input: PaymentInitializationInput) {
  if (!featureFlags.hasPaystack) {
    logWarn("Paystack initialize called without full Paystack configuration. Returning demo response.");
    return {
      provider: "PAYSTACK",
      authorizationUrl: "#",
      accessCode: "demo-access-code",
      reference: input.reference,
      mode: "demo" as const,
      transferInstructions:
        input.channels?.includes("bank_transfer")
          ? {
              bankName: null,
              accountNumber: null,
              accountName: null,
              expiresAt: null,
            }
          : null,
      providerPayload: { demo: true },
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
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: input.channels,
      ...(input.splitConfig?.subaccount
        ? {
            subaccount: input.splitConfig.subaccount,
            transaction_charge: Math.round(input.splitConfig.transactionCharge ?? 0),
            bearer: input.splitConfig.bearer ?? "subaccount",
          }
        : {}),
    }),
  });

  if (!response.ok) {
    logError("Paystack initialize request failed.", {
      status: response.status,
    });
    throw new Error("Failed to initialize Paystack payment.");
  }

  const json = (await response.json()) as Record<string, unknown>;
  const data =
    typeof json["data"] === "object" && json["data"] !== null
      ? (json["data"] as Record<string, unknown>)
      : {};

  return {
    provider: "PAYSTACK",
    authorizationUrl: typeof data["authorization_url"] === "string" ? data["authorization_url"] : "#",
    accessCode: typeof data["access_code"] === "string" ? data["access_code"] : null,
    reference: typeof data["reference"] === "string" ? data["reference"] : input.reference,
    mode: "live" as const,
    transferInstructions: extractTransferInstructions(json),
    providerPayload: json,
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

export function createReceiptFromPayment(reference: string, amount: number, currency = "NGN") {
  return {
    receiptNumber: `RCT-${reference.toUpperCase()}`,
    totalAmount: amount,
    currency,
  };
}
