/**
 * WhatsApp Business API wrapper via Twilio.
 *
 * Lazy-initializes the Twilio client on first use. All sends are tenant-aware
 * and write a best-effort usage log for Phase 1 observability.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { logWarn } from "@/lib/ops/logger";
import { getOrCreateCompanyWallet, recordUsage } from "@/modules/communication/wallet";
import { sanitizeWhatsAppNumber } from "@/modules/team/contact";

interface SendWhatsAppOptions {
  companyId: string;
  trigger: string;
  to: string | null | undefined;
  body: string;
  metadata?: Prisma.InputJsonValue;
}

type WhatsAppUsageStatus = "SENT" | "FAILED" | "SKIPPED";

type WhatsAppUsageLogInput = {
  companyId: string;
  trigger: string;
  recipientPhone: string | null;
  status: WhatsAppUsageStatus;
  providerSid?: string | null;
  error?: string | null;
  metadata?: Prisma.InputJsonValue;
};

interface TwilioClient {
  messages: {
    create(opts: { from: string; to: string; body: string }): Promise<{ sid: string }>;
  };
}

let client: TwilioClient | null = null;

function getTwilioClient(): TwilioClient | null {
  if (!featureFlags.hasTwilio) {
    return null;
  }

  if (client) {
    return client;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const twilio = require("twilio") as (sid: string, token: string) => TwilioClient;
  client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  return client;
}

export function normalizeWhatsAppRecipient(value: string | null | undefined) {
  const digits = sanitizeWhatsAppNumber(value);
  return digits ? `whatsapp:+${digits}` : null;
}

export function buildWhatsAppUsageLogInput(
  input: WhatsAppUsageLogInput,
): WhatsAppUsageLogInput & {
  channel: "WHATSAPP";
  provider: "TWILIO";
  providerSid: string | null;
  error: string | null;
} {
  return {
    companyId: input.companyId,
    channel: "WHATSAPP",
    trigger: input.trigger,
    recipientPhone: input.recipientPhone,
    status: input.status,
    provider: "TWILIO",
    providerSid: input.providerSid ?? null,
    error: input.error ?? null,
    metadata: input.metadata,
  };
}

export function getWhatsAppCreditBlockReason(wallet: { balance: number; isBlocked: boolean }) {
  if (wallet.isBlocked) {
    return "blocked_no_credits" as const;
  }

  if (wallet.balance <= 0) {
    return "blocked_no_credits" as const;
  }

  return null;
}

async function recordWhatsAppUsage(input: WhatsAppUsageLogInput) {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  try {
    const usageLog = await prisma.communicationUsageLog.create({
      data: buildWhatsAppUsageLogInput(input),
      select: {
        id: true,
      },
    });
    return usageLog.id;
  } catch (error) {
    logWarn("Unable to record WhatsApp usage log.", {
      companyId: input.companyId,
      trigger: input.trigger,
      status: input.status,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return null;
  }
}

async function recordWhatsAppAttempt(input: WhatsAppUsageLogInput, options?: { chargeCredits?: boolean }) {
  const usageLogId = await recordWhatsAppUsage(input);

  if (!options?.chargeCredits) {
    return;
  }

  try {
    await recordUsage({
      companyId: input.companyId,
      credits: 1,
      reference: usageLogId,
      metadata: {
        channel: "WHATSAPP",
        provider: "TWILIO",
        trigger: input.trigger,
        usageLogId,
        status: input.status,
        providerSid: input.providerSid ?? null,
        recipientPhone: input.recipientPhone,
      } as Prisma.InputJsonValue,
    });
  } catch (error) {
    logWarn("Unable to record WhatsApp credit usage.", {
      companyId: input.companyId,
      trigger: input.trigger,
      usageLogId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }
}

export async function sendWhatsAppMessage(opts: SendWhatsAppOptions): Promise<
  { sent: true; sid: string } | { sent: false; reason: string }
> {
  const recipientPhone = normalizeWhatsAppRecipient(opts.to) ?? opts.to ?? null;
  const wallet = await getOrCreateCompanyWallet(opts.companyId);
  const blockReason = getWhatsAppCreditBlockReason(wallet);

  if (blockReason) {
    await recordWhatsAppAttempt({
      companyId: opts.companyId,
      trigger: opts.trigger,
      recipientPhone,
      status: "SKIPPED",
      error: wallet.isBlocked ? "wallet_blocked" : "blocked_no_credits",
      metadata: opts.metadata,
    });
    return { sent: false, reason: blockReason };
  }

  const twilioClient = getTwilioClient();

  if (!twilioClient) {
    await recordWhatsAppAttempt({
      companyId: opts.companyId,
      trigger: opts.trigger,
      recipientPhone,
      status: "SKIPPED",
      error: "twilio_not_configured",
      metadata: opts.metadata,
    });
    return { sent: false, reason: "twilio_not_configured" };
  }

  const to = normalizeWhatsAppRecipient(opts.to);
  if (!to) {
    await recordWhatsAppAttempt({
      companyId: opts.companyId,
      trigger: opts.trigger,
      recipientPhone,
      status: "SKIPPED",
      error: "no_phone_number",
      metadata: opts.metadata,
    });
    return { sent: false, reason: "no_phone_number" };
  }

  try {
    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to,
      body: opts.body,
    });

    await recordWhatsAppAttempt({
      companyId: opts.companyId,
      trigger: opts.trigger,
      recipientPhone: to,
      status: "SENT",
      providerSid: message.sid,
      metadata: opts.metadata,
    }, { chargeCredits: true });

    return { sent: true, sid: message.sid };
  } catch (error) {
    logWarn("Twilio WhatsApp send failed.", {
      companyId: opts.companyId,
      trigger: opts.trigger,
      errorName: error instanceof Error ? error.name : typeof error,
    });

    await recordWhatsAppAttempt({
      companyId: opts.companyId,
      trigger: opts.trigger,
      recipientPhone: to,
      status: "FAILED",
      error: error instanceof Error ? error.message : "twilio_error",
      metadata: opts.metadata,
    });

    return { sent: false, reason: "twilio_error" };
  }
}
