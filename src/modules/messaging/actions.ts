"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
import { createBuyerThread, sendMessage } from "@/modules/messaging/service";

export type MessageFormState = { ok: boolean; error: string | null };

function nameFrom(session: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const full = [session.firstName, session.lastName].filter(Boolean).join(" ").trim();
  return full || session.email || "User";
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** Buyer starts a new conversation with the sales team. */
export async function createThreadAction(
  _prev: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const session = await requirePortalSession();
  const { companyId, userId } = session;
  if (!companyId) return { ok: false, error: "No workspace context." };
  if (!userId) return { ok: false, error: "No user context." };

  const result = await createBuyerThread({
    companyId,
    buyerUserId: userId,
    buyerName: nameFrom(session),
    subject: str(formData.get("subject")),
    body: str(formData.get("body")),
  });

  if (result.ok) revalidatePath("/portal/messages");
  return { ok: result.ok, error: result.error };
}

/** Buyer replies within a thread. */
export async function replyBuyerAction(
  _prev: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const session = await requirePortalSession();
  if (!session.companyId) return { ok: false, error: "No workspace context." };

  const result = await sendMessage({
    companyId: session.companyId,
    threadId: str(formData.get("threadId")),
    senderRole: "BUYER",
    senderName: nameFrom(session),
    senderUserId: session.userId,
    body: str(formData.get("body")),
  });

  if (result.ok) revalidatePath("/portal/messages");
  return { ok: result.ok, error: result.error };
}

/** Operator (sales team) replies within a thread. */
export async function replyAdminAction(
  _prev: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const session = await requireAdminSession(["ADMIN", "STAFF", "LEGAL", "FINANCE"]);
  if (!session.companyId) return { ok: false, error: "No workspace context." };

  const result = await sendMessage({
    companyId: session.companyId,
    threadId: str(formData.get("threadId")),
    senderRole: "TEAM",
    senderName: nameFrom(session),
    senderUserId: session.userId,
    body: str(formData.get("body")),
  });

  if (result.ok) revalidatePath("/admin/messages");
  return { ok: result.ok, error: result.error };
}
