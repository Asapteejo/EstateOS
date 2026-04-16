"use server";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";

export async function sendDraftReplyAction(
  recipientEmail: string,
  recipientName: string,
  draftText: string,
  inquiryId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await requireAdminSession();
  if (!tenant.companyId) return { ok: false, error: "Unauthorized." };
  if (!recipientEmail || !draftText.trim()) return { ok: false, error: "Missing required fields." };

  try {
    await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Re: Your property enquiry`,
      html: `<p style="white-space:pre-wrap">${draftText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    });

    // Sending a reply is a follow-up action — update lastFollowedUpAt on any
    // active transaction belonging to this inquiry's buyer.
    if (inquiryId && featureFlags.hasDatabase) {
      const inquiry = await prisma.inquiry.findFirst({
        where: { id: inquiryId, companyId: tenant.companyId },
        select: { userId: true },
      });
      if (inquiry?.userId) {
        await prisma.transaction.updateMany({
          where: {
            companyId: tenant.companyId,
            userId: inquiry.userId,
            currentStage: { notIn: ["FINAL_PAYMENT_COMPLETED", "HANDOVER_COMPLETED"] },
          },
          data: { lastFollowedUpAt: new Date() },
        });
      }
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to send email." };
  }
}
