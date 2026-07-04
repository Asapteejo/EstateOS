import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

export type MessageSenderRole = "BUYER" | "TEAM";

export type ThreadSummary = {
  id: string;
  subject: string;
  buyerName: string;
  preview: string;
  lastMessageAt: string;
  unread: boolean;
};

export type ThreadMessage = {
  id: string;
  body: string;
  senderRole: MessageSenderRole;
  senderName: string;
  when: string;
  mine: boolean;
};

export type ThreadDetail = {
  id: string;
  subject: string;
  buyerName: string;
  /** Buyer phone for operator click-to-chat; only populated for the team view. */
  buyerPhone: string | null;
  messages: ThreadMessage[];
};

type Ctx = { companyId: string | null; userId?: string | null };

function fmt(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Hard caps to keep a single message/subject from bloating storage or the UI. */
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_SUBJECT_LENGTH = 200;

export function makePreview(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > 90 ? `${clean.slice(0, 89)}…` : clean;
}

/** Pure unread predicates so the buyer/team badge logic is testable in isolation
 *  and can never drift between the list views and the count queries. A side is
 *  "unread" when the OTHER side sent the latest message and this side hasn't
 *  opened the thread since. */
export function isThreadUnreadForBuyer(thread: {
  lastMessageSenderRole: string | null;
  lastMessageAt: Date;
  buyerLastReadAt: Date | null;
}): boolean {
  return (
    thread.lastMessageSenderRole === "TEAM" &&
    (!thread.buyerLastReadAt || thread.buyerLastReadAt < thread.lastMessageAt)
  );
}

export function isThreadUnreadForTeam(thread: {
  lastMessageSenderRole: string | null;
  lastMessageAt: Date;
  teamLastReadAt: Date | null;
}): boolean {
  return (
    thread.lastMessageSenderRole === "BUYER" &&
    (!thread.teamLastReadAt || thread.teamLastReadAt < thread.lastMessageAt)
  );
}

/** Threads for the signed-in buyer, newest first. Unread when the team sent the
 *  latest message and the buyer hasn't opened the thread since. */
export async function listBuyerThreads(ctx: Ctx): Promise<ThreadSummary[]> {
  if (!featureFlags.hasDatabase || !ctx.companyId || !ctx.userId) return [];
  try {
    const threads = await prisma.messageThread.findMany({
      where: { companyId: ctx.companyId, buyerUserId: ctx.userId },
      orderBy: { lastMessageAt: "desc" },
    });
    return threads.map((t) => ({
      id: t.id,
      subject: t.subject,
      buyerName: t.buyerName ?? "You",
      preview: t.lastMessagePreview ?? "",
      lastMessageAt: fmt(t.lastMessageAt),
      unread: isThreadUnreadForBuyer(t),
    }));
  } catch (error) {
    logError("listBuyerThreads failed", buildSafeErrorLogContext(error));
    return [];
  }
}

/** All buyer conversations for the operator inbox, newest first. Unread when the
 *  buyer sent the latest message and no team member has opened it since. */
export async function listAdminThreads(ctx: Ctx): Promise<ThreadSummary[]> {
  if (!featureFlags.hasDatabase || !ctx.companyId) return [];
  try {
    const threads = await prisma.messageThread.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { lastMessageAt: "desc" },
      take: 200,
    });
    return threads.map((t) => ({
      id: t.id,
      subject: t.subject,
      buyerName: t.buyerName ?? "Buyer",
      preview: t.lastMessagePreview ?? "",
      lastMessageAt: fmt(t.lastMessageAt),
      unread: isThreadUnreadForTeam(t),
    }));
  } catch (error) {
    logError("listAdminThreads failed", buildSafeErrorLogContext(error));
    return [];
  }
}

/** Fetch a thread with its messages and mark it read for the viewing side. */
export async function getThread(
  ctx: Ctx,
  threadId: string,
  viewer: "buyer" | "team",
): Promise<ThreadDetail | null> {
  if (!featureFlags.hasDatabase || !ctx.companyId) return null;
  // A buyer viewer must be identified; without a userId we cannot scope the thread
  // to them, so refuse rather than fall back to a company-wide (cross-user) read.
  if (viewer === "buyer" && !ctx.userId) return null;
  try {
    const thread = await prisma.messageThread.findFirst({
      where: {
        id: threadId,
        companyId: ctx.companyId,
        ...(viewer === "buyer" ? { buyerUserId: ctx.userId! } : {}),
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!thread) return null;

    // Mark read for the viewing side (best effort — never blocks the render).
    try {
      await prisma.messageThread.update({
        where: { id: thread.id },
        data: viewer === "buyer" ? { buyerLastReadAt: new Date() } : { teamLastReadAt: new Date() },
      });
    } catch {
      /* non-fatal */
    }

    // Only the team view exposes the buyer's phone (for click-to-chat) — buyers
    // don't need their own number surfaced here.
    let buyerPhone: string | null = null;
    if (viewer === "team") {
      try {
        const buyer = await prisma.user.findUnique({
          where: { id: thread.buyerUserId },
          select: { phone: true },
        });
        buyerPhone = buyer?.phone ?? null;
      } catch {
        /* non-fatal */
      }
    }

    return {
      id: thread.id,
      subject: thread.subject,
      buyerName: thread.buyerName ?? "Buyer",
      buyerPhone,
      messages: thread.messages.map((m) => ({
        id: m.id,
        body: m.body,
        senderRole: m.senderRole as MessageSenderRole,
        senderName: m.senderName ?? (m.senderRole === "BUYER" ? "Buyer" : "Team"),
        when: fmt(m.createdAt),
        mine:
          viewer === "buyer" ? m.senderRole === "BUYER" : m.senderRole === "TEAM",
      })),
    };
  } catch (error) {
    logError("getThread failed", buildSafeErrorLogContext(error));
    return null;
  }
}

async function unreadCount(ctx: Ctx, side: "buyer" | "team"): Promise<number> {
  if (!featureFlags.hasDatabase || !ctx.companyId) return 0;
  if (side === "buyer" && !ctx.userId) return 0;
  try {
    const threads = await prisma.messageThread.findMany({
      where: {
        companyId: ctx.companyId,
        ...(side === "buyer" ? { buyerUserId: ctx.userId! } : {}),
      },
      select: {
        lastMessageAt: true,
        lastMessageSenderRole: true,
        buyerLastReadAt: true,
        teamLastReadAt: true,
      },
    });
    return threads.filter((t) =>
      side === "buyer" ? isThreadUnreadForBuyer(t) : isThreadUnreadForTeam(t),
    ).length;
  } catch (error) {
    logError("unreadCount failed", buildSafeErrorLogContext(error));
    return 0;
  }
}

export function getBuyerUnreadCount(ctx: Ctx): Promise<number> {
  return unreadCount(ctx, "buyer");
}

export function getTeamUnreadCount(ctx: Ctx): Promise<number> {
  return unreadCount(ctx, "team");
}

/** Append a message to an existing thread and bump its summary fields. The
 *  sender's own side is marked read; the other side is left unread. */
export async function sendMessage(input: {
  companyId: string;
  threadId: string;
  senderRole: MessageSenderRole;
  senderName: string;
  senderUserId?: string | null;
  body: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message cannot be empty." };
  if (body.length > MAX_MESSAGE_LENGTH) return { ok: false, error: "Message is too long." };
  if (input.senderRole === "BUYER" && !input.senderUserId) {
    return { ok: false, error: "No user context." };
  }
  if (!featureFlags.hasDatabase) return { ok: false, error: "Messaging is not available yet." };
  try {
    // Authorize the write: the thread must belong to the sender's company, and a
    // buyer may only post to their OWN thread. This blocks cross-tenant and
    // cross-user (IDOR) writes via a forged threadId from the form.
    const thread = await prisma.messageThread.findFirst({
      where: {
        id: input.threadId,
        companyId: input.companyId,
        ...(input.senderRole === "BUYER" ? { buyerUserId: input.senderUserId! } : {}),
      },
      select: { buyerUserId: true },
    });
    if (!thread) return { ok: false, error: "Conversation not found." };

    const now = new Date();
    await prisma.$transaction([
      prisma.message.create({
        data: {
          threadId: input.threadId,
          companyId: input.companyId,
          senderUserId: input.senderUserId ?? null,
          senderRole: input.senderRole,
          senderName: input.senderName,
          body,
        },
      }),
      prisma.messageThread.update({
        where: { id: input.threadId },
        data: {
          lastMessageAt: now,
          lastMessagePreview: makePreview(body),
          lastMessageSenderRole: input.senderRole,
          ...(input.senderRole === "BUYER"
            ? { buyerLastReadAt: now }
            : { teamLastReadAt: now }),
        },
      }),
    ]);

    // When the team replies, notify the buyer across channels. Both are
    // best-effort: a notification/WhatsApp hiccup must never block the message.
    if (input.senderRole === "TEAM" && thread.buyerUserId) {
      // 1) In-app bell notification.
      try {
        await prisma.notification.create({
          data: {
            companyId: input.companyId,
            userId: thread.buyerUserId,
            type: "SYSTEM",
            channel: "IN_APP",
            title: "New message from the sales team",
            body: makePreview(body),
            metadata: { threadId: input.threadId },
          },
        });
      } catch {
        /* non-fatal */
      }

      // 2) WhatsApp (via the shared Twilio + wallet layer). This no-ops safely
      //    when the buyer has no phone, Twilio is unconfigured, or the company's
      //    messaging wallet is out of credit — so it's safe to always attempt.
      try {
        const buyer = await prisma.user.findUnique({
          where: { id: thread.buyerUserId },
          select: { phone: true, firstName: true },
        });
        if (buyer?.phone) {
          await sendWhatsAppMessage({
            companyId: input.companyId,
            trigger: "messaging.team_reply",
            to: buyer.phone,
            body: `Hi ${buyer.firstName ?? "there"}, you have a new reply from the sales team. Open your portal to read it: ${makePreview(body)}`,
            metadata: { threadId: input.threadId },
          });
        }
      } catch {
        /* non-fatal */
      }
    }

    return { ok: true, error: null };
  } catch (error) {
    logError("sendMessage failed", buildSafeErrorLogContext(error));
    return { ok: false, error: "Could not send your message. Please try again." };
  }
}

/** Buyer starts a new conversation with the sales team. */
export async function createBuyerThread(input: {
  companyId: string;
  buyerUserId: string;
  buyerName: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error: string | null; threadId?: string }> {
  const subject = input.subject.trim().slice(0, MAX_SUBJECT_LENGTH);
  const body = input.body.trim();
  if (!subject) return { ok: false, error: "Please add a subject." };
  if (!body) return { ok: false, error: "Please write a message." };
  if (body.length > MAX_MESSAGE_LENGTH) return { ok: false, error: "Message is too long." };
  if (!input.buyerUserId) return { ok: false, error: "No user context." };
  if (!featureFlags.hasDatabase) return { ok: false, error: "Messaging is not available yet." };
  try {
    const now = new Date();
    const thread = await prisma.messageThread.create({
      data: {
        companyId: input.companyId,
        buyerUserId: input.buyerUserId,
        buyerName: input.buyerName,
        subject,
        lastMessageAt: now,
        lastMessagePreview: makePreview(body),
        lastMessageSenderRole: "BUYER",
        buyerLastReadAt: now,
        messages: {
          create: {
            companyId: input.companyId,
            senderUserId: input.buyerUserId,
            senderRole: "BUYER",
            senderName: input.buyerName,
            body,
          },
        },
      },
    });
    return { ok: true, error: null, threadId: thread.id };
  } catch (error) {
    logError("createBuyerThread failed", buildSafeErrorLogContext(error));
    return { ok: false, error: "Could not start the conversation. Please try again." };
  }
}
