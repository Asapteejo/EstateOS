import type { AppRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { publishDomainEvent } from "@/lib/notifications/events";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

export type AnnouncementAudience = "BUYERS" | "OPERATORS" | "ALL";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  isPublished: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdByName: string | null;
  isExpired: boolean;
};

export type AnnouncementNotice = {
  id: string;
  title: string;
  body: string;
  when: string;
};

type Ctx = { companyId: string | null };

export const MAX_ANNOUNCEMENT_TITLE = 140;
export const MAX_ANNOUNCEMENT_BODY = 2000;

function fmtDate(date: Date): string {
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

/** Create a broadcast. Title/body are capped; expiry is optional. */
export async function createAnnouncement(input: {
  companyId: string;
  title: string;
  body: string;
  audience?: AnnouncementAudience;
  expiresAt?: Date | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const title = input.title.trim().slice(0, MAX_ANNOUNCEMENT_TITLE);
  const body = input.body.trim().slice(0, MAX_ANNOUNCEMENT_BODY);
  if (!title) return { ok: false, error: "Please add a title." };
  if (!body) return { ok: false, error: "Please write the announcement." };
  if (!featureFlags.hasDatabase) return { ok: false, error: "Announcements are not available yet." };
  try {
    const created = await prisma.announcement.create({
      data: {
        companyId: input.companyId,
        title,
        body,
        audience: input.audience ?? "BUYERS",
        expiresAt: input.expiresAt ?? null,
        createdByUserId: input.createdByUserId ?? null,
        createdByName: input.createdByName ?? null,
      },
      select: { id: true },
    });

    // Fan out a WhatsApp broadcast to the target audience in the background.
    // No-ops safely when Inngest / Twilio / wallet credit aren't configured.
    try {
      await publishDomainEvent("announcement/published", { announcementId: created.id });
    } catch (error) {
      logError("announcement broadcast dispatch failed", buildSafeErrorLogContext(error));
    }

    return { ok: true, error: null };
  } catch (error) {
    logError("createAnnouncement failed", buildSafeErrorLogContext(error));
    return { ok: false, error: "Could not post the announcement. Please try again." };
  }
}

/** Publish / unpublish a broadcast, scoped to the acting company. */
export async function setAnnouncementPublished(
  ctx: Ctx,
  id: string,
  isPublished: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  if (!featureFlags.hasDatabase || !ctx.companyId) {
    return { ok: false, error: "Announcements are not available yet." };
  }
  try {
    const result = await prisma.announcement.updateMany({
      where: { id, companyId: ctx.companyId },
      data: { isPublished },
    });
    if (result.count === 0) return { ok: false, error: "Announcement not found." };
    return { ok: true, error: null };
  } catch (error) {
    logError("setAnnouncementPublished failed", buildSafeErrorLogContext(error));
    return { ok: false, error: "Could not update the announcement." };
  }
}

/** All announcements for the operator management view, newest first. */
export async function listAnnouncementsForAdmin(ctx: Ctx): Promise<AnnouncementRow[]> {
  if (!featureFlags.hasDatabase || !ctx.companyId) return [];
  try {
    const now = new Date();
    const rows = await prisma.announcement.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience as AnnouncementAudience,
      isPublished: a.isPublished,
      publishedAt: fmtDate(a.publishedAt),
      expiresAt: a.expiresAt ? fmtDate(a.expiresAt) : null,
      createdByName: a.createdByName,
      isExpired: Boolean(a.expiresAt && a.expiresAt < now),
    }));
  } catch (error) {
    logError("listAnnouncementsForAdmin failed", buildSafeErrorLogContext(error));
    return [];
  }
}

/** Shared reader: published, unexpired notices for the given audiences, newest
 *  first and capped so a banner stays compact. */
async function getActiveNotices(
  ctx: Ctx,
  audiences: AnnouncementAudience[],
): Promise<AnnouncementNotice[]> {
  if (!featureFlags.hasDatabase || !ctx.companyId) return [];
  try {
    const now = new Date();
    const rows = await prisma.announcement.findMany({
      where: {
        companyId: ctx.companyId,
        isPublished: true,
        audience: { in: audiences },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: { id: true, title: true, body: true, publishedAt: true },
    });
    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      when: fmtDate(a.publishedAt),
    }));
  } catch (error) {
    logError("getActiveNotices failed", buildSafeErrorLogContext(error));
    return [];
  }
}

/** Active announcements a buyer should see (targeted at buyers or everyone). */
export function getActiveBuyerAnnouncements(ctx: Ctx): Promise<AnnouncementNotice[]> {
  return getActiveNotices(ctx, ["BUYERS", "ALL"]);
}

/** Active announcements an operator should see (targeted at staff or everyone). */
export function getActiveOperatorAnnouncements(ctx: Ctx): Promise<AnnouncementNotice[]> {
  return getActiveNotices(ctx, ["OPERATORS", "ALL"]);
}

/** The company roles an announcement's audience should reach on WhatsApp. */
function audienceRoleNames(audience: AnnouncementAudience): AppRole[] {
  if (audience === "OPERATORS") return ["ADMIN", "STAFF", "FINANCE", "LEGAL"];
  if (audience === "ALL") return ["ADMIN", "STAFF", "FINANCE", "LEGAL", "BUYER"];
  return ["BUYER"];
}

/**
 * Fan out a published announcement to its audience over WhatsApp. Runs from a
 * background job (see the `announcement/published` Inngest function) so a large
 * recipient set never blocks the request. Each send goes through the shared
 * Twilio + wallet layer, which no-ops safely when unconfigured — so this is a
 * best-effort broadcast that activates once WhatsApp credentials + credit exist.
 */
export async function broadcastAnnouncementWhatsApp(
  announcementId: string,
): Promise<{ recipients: number; sent: number }> {
  if (!featureFlags.hasDatabase) return { recipients: 0, sent: 0 };
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, companyId: true, title: true, body: true, audience: true, isPublished: true },
    });
    if (!announcement || !announcement.isPublished) return { recipients: 0, sent: 0 };

    const roleNames = audienceRoleNames(announcement.audience as AnnouncementAudience);
    const recipients = await prisma.user.findMany({
      where: {
        companyId: announcement.companyId,
        isActive: true,
        phone: { not: null },
        roles: {
          some: {
            companyId: announcement.companyId,
            role: { companyId: announcement.companyId, name: { in: roleNames } },
          },
        },
      },
      select: { id: true, phone: true },
      take: 2000,
    });

    const body = `${announcement.title}\n\n${announcement.body}`;
    let sent = 0;
    for (const recipient of recipients) {
      if (!recipient.phone) continue;
      const result = await sendWhatsAppMessage({
        companyId: announcement.companyId,
        trigger: "announcement.broadcast",
        to: recipient.phone,
        body,
        metadata: { announcementId: announcement.id, recipientUserId: recipient.id },
      });
      if (result.sent) sent += 1;
    }
    return { recipients: recipients.length, sent };
  } catch (error) {
    logError("broadcastAnnouncementWhatsApp failed", buildSafeErrorLogContext(error));
    return { recipients: 0, sent: 0 };
  }
}
