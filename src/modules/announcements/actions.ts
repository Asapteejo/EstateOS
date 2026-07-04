"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import {
  createAnnouncement,
  setAnnouncementPublished,
  type AnnouncementAudience,
} from "@/modules/announcements/service";

export type AnnouncementFormState = { ok: boolean; error: string | null };

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function nameFrom(session: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const full = [session.firstName, session.lastName].filter(Boolean).join(" ").trim();
  return full || session.email || "Team";
}

function parseAudience(value: string): AnnouncementAudience {
  return value === "OPERATORS" || value === "ALL" ? value : "BUYERS";
}

export async function createAnnouncementAction(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const session = await requireAdminSession(rolesForAdminPath("/admin/announcements"));
  if (!session.companyId) return { ok: false, error: "No workspace context." };

  const expiresRaw = str(formData.get("expiresAt"));
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;

  const result = await createAnnouncement({
    companyId: session.companyId,
    title: str(formData.get("title")),
    body: str(formData.get("body")),
    audience: parseAudience(str(formData.get("audience"))),
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    createdByUserId: session.userId,
    createdByName: nameFrom(session),
  });

  if (result.ok) revalidatePath("/admin/announcements");
  return { ok: result.ok, error: result.error };
}

/** Publish / unpublish toggle used by the management list (plain form action). */
export async function toggleAnnouncementAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession(rolesForAdminPath("/admin/announcements"));
  if (!session.companyId) return;
  await setAnnouncementPublished(
    session,
    str(formData.get("id")),
    str(formData.get("isPublished")) === "true",
  );
  revalidatePath("/admin/announcements");
}
