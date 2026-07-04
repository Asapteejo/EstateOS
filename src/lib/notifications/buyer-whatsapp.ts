import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

/**
 * Best-effort WhatsApp notification to a buyer. Looks up their phone + first
 * name, then dispatches through the shared Twilio + wallet layer, which no-ops
 * safely when the buyer has no phone, Twilio is unconfigured, or the company's
 * messaging wallet is out of credit. Never throws — callers can fire-and-forget.
 */
export async function notifyBuyerWhatsApp(input: {
  companyId: string;
  buyerUserId: string | null | undefined;
  trigger: string;
  /** Compose the message from the buyer's first name (falls back to "there"). */
  buildBody: (firstName: string) => string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  if (!input.buyerUserId) return;
  try {
    const buyer = await prisma.user.findUnique({
      where: { id: input.buyerUserId },
      select: { phone: true, firstName: true },
    });
    if (!buyer?.phone) return;
    await sendWhatsAppMessage({
      companyId: input.companyId,
      trigger: input.trigger,
      to: buyer.phone,
      body: input.buildBody(buyer.firstName ?? "there"),
      metadata: input.metadata,
    });
  } catch {
    /* WhatsApp delivery must never break the surrounding operation */
  }
}
