import { addDays, formatDistanceToNowStrict, isAfter, isBefore, isEqual, subDays } from "date-fns";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { notifyManyUsers } from "@/lib/notifications/service";
import { formatDate } from "@/lib/utils";
import { getCompanyOperationalDefaults } from "@/modules/settings/service";

export const DEFAULT_PROPERTY_VERIFICATION_THRESHOLDS = {
  freshDays: 7,
  staleDays: 30,
  hideDays: 45,
  warningReminderDays: 2,
} as const;

export type PropertyVerificationThresholds = {
  freshDays: number;
  staleDays: number;
  hideDays: number;
  warningReminderDays: number;
};

export type PropertyVerificationRecord = {
  id?: string;
  title?: string;
  slug?: string;
  companyId?: string | null;
  status?: string;
  lastVerifiedAt?: Date | string | null;
  verificationStatus?: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN" | null;
  verificationDueAt?: Date | string | null;
  isPubliclyVisible?: boolean | null;
  autoHiddenAt?: Date | string | null;
  verificationNotes?: string | null;
  verificationWarningSentAt?: Date | string | null;
  hiddenNotificationSentAt?: Date | string | null;
};

export type PropertyVerificationPresentation = {
  status: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN";
  label: string;
  detail: string;
  tone: "success" | "warning" | "muted";
  isPubliclyVisible: boolean;
  lastVerifiedAt: Date | null;
  verificationDueAt: Date;
  autoHiddenAt: Date | null;
};

type PropertyNotificationTarget = {
  id: string;
  title: string;
  companyId: string;
  verificationDueAt?: Date | string | null;
};

function normalizeDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function normalizeVerificationThresholds(
  thresholds?: Partial<PropertyVerificationThresholds> | null,
): PropertyVerificationThresholds {
  const freshDays = thresholds?.freshDays ?? DEFAULT_PROPERTY_VERIFICATION_THRESHOLDS.freshDays;
  const requestedStaleDays = thresholds?.staleDays ?? DEFAULT_PROPERTY_VERIFICATION_THRESHOLDS.staleDays;
  const staleDays = Math.max(requestedStaleDays, freshDays + 1);
  const requestedHideDays = thresholds?.hideDays ?? DEFAULT_PROPERTY_VERIFICATION_THRESHOLDS.hideDays;
  const hideDays = Math.max(requestedHideDays, staleDays + 1);
  const requestedWarningReminderDays =
    thresholds?.warningReminderDays ??
    DEFAULT_PROPERTY_VERIFICATION_THRESHOLDS.warningReminderDays;

  return {
    freshDays,
    staleDays,
    hideDays,
    warningReminderDays: Math.min(requestedWarningReminderDays, Math.max(hideDays - 1, 1)),
  };
}

export async function getVerificationThresholdsForCompany(companyId?: string | null) {
  if (!companyId || !featureFlags.hasDatabase) {
    return normalizeVerificationThresholds();
  }

  const defaults = await getCompanyOperationalDefaults(companyId);
  return normalizeVerificationThresholds({
    freshDays: defaults.verificationFreshDays,
    staleDays: defaults.verificationStaleDays,
    hideDays: defaults.verificationHideDays,
    warningReminderDays: defaults.verificationWarningReminderDays,
  });
}

export function computeVerificationStatus(
  property: Pick<PropertyVerificationRecord, "lastVerifiedAt">,
  thresholds?: Partial<PropertyVerificationThresholds> | null,
  now = new Date(),
) {
  const lastVerifiedAt = normalizeDate(property.lastVerifiedAt);
  const effectiveThresholds = normalizeVerificationThresholds(thresholds);

  if (!lastVerifiedAt) {
    return "UNVERIFIED" as const;
  }

  if (
    isAfter(lastVerifiedAt, subDays(now, effectiveThresholds.freshDays)) ||
    isEqual(lastVerifiedAt, subDays(now, effectiveThresholds.freshDays))
  ) {
    return "VERIFIED" as const;
  }

  if (
    isAfter(lastVerifiedAt, subDays(now, effectiveThresholds.hideDays)) ||
    isEqual(lastVerifiedAt, subDays(now, effectiveThresholds.hideDays))
  ) {
    return "STALE" as const;
  }

  return "HIDDEN" as const;
}

export function updateVerificationState(
  property: PropertyVerificationRecord,
  thresholds?: Partial<PropertyVerificationThresholds> | null,
  now = new Date(),
) {
  const lastVerifiedAt = normalizeDate(property.lastVerifiedAt);
  const effectiveThresholds = normalizeVerificationThresholds(thresholds);
  if (property.status === "ARCHIVED") {
    return {
      verificationStatus: "HIDDEN" as const,
      verificationDueAt: lastVerifiedAt ? addDays(lastVerifiedAt, effectiveThresholds.freshDays) : now,
      isPubliclyVisible: false,
      autoHiddenAt: normalizeDate(property.autoHiddenAt) ?? now,
    };
  }

  const verificationStatus = computeVerificationStatus(property, effectiveThresholds, now);
  const verificationDueAt = lastVerifiedAt ? addDays(lastVerifiedAt, effectiveThresholds.freshDays) : now;
  const isPubliclyVisible = verificationStatus === "VERIFIED" || verificationStatus === "STALE";
  const autoHiddenAt =
    verificationStatus === "HIDDEN" ? normalizeDate(property.autoHiddenAt) ?? now : null;

  return {
    verificationStatus,
    verificationDueAt,
    isPubliclyVisible,
    autoHiddenAt,
  };
}

export function buildPropertyVerificationPresentation(
  property: PropertyVerificationRecord,
  thresholds?: Partial<PropertyVerificationThresholds> | null,
  now = new Date(),
): PropertyVerificationPresentation {
  const lastVerifiedAt = normalizeDate(property.lastVerifiedAt);
  const nextState = updateVerificationState(property, thresholds, now);

  if (!lastVerifiedAt) {
    return {
      status: nextState.verificationStatus,
      label: "Verification required",
      detail: "This listing has not been verified yet and is hidden from public inventory.",
      tone: "muted",
      lastVerifiedAt: null,
      verificationDueAt: nextState.verificationDueAt,
      isPubliclyVisible: nextState.isPubliclyVisible,
      autoHiddenAt: nextState.autoHiddenAt,
    };
  }

  if (nextState.verificationStatus === "VERIFIED") {
    return {
      status: nextState.verificationStatus,
      label: `Verified ${formatDistanceToNowStrict(lastVerifiedAt, { addSuffix: true })}`,
      detail: `Next verification due ${formatDate(nextState.verificationDueAt, "PPP")}.`,
      tone: "success",
      lastVerifiedAt,
      verificationDueAt: nextState.verificationDueAt,
      isPubliclyVisible: nextState.isPubliclyVisible,
      autoHiddenAt: nextState.autoHiddenAt,
    };
  }

  if (nextState.verificationStatus === "STALE") {
    return {
      status: nextState.verificationStatus,
      label: `Last updated ${formatDistanceToNowStrict(lastVerifiedAt, { addSuffix: true })}`,
      detail: "This listing is stale. Buyers can still view it, but admins should re-verify it soon.",
      tone: "warning",
      lastVerifiedAt,
      verificationDueAt: nextState.verificationDueAt,
      isPubliclyVisible: nextState.isPubliclyVisible,
      autoHiddenAt: nextState.autoHiddenAt,
    };
  }

  return {
    status: nextState.verificationStatus,
    label: "Listing hidden",
    detail: "This listing is no longer public because its verification window expired.",
    tone: "muted",
    lastVerifiedAt,
    verificationDueAt: nextState.verificationDueAt,
    isPubliclyVisible: nextState.isPubliclyVisible,
    autoHiddenAt: nextState.autoHiddenAt,
  };
}

export function buildPublicPropertyVerificationWhere() {
  return {
    isPubliclyVisible: true,
    verificationStatus: {
      in: ["VERIFIED", "STALE"],
    },
  };
}

export function buildPropertyVerificationUpdateInput(
  now = new Date(),
  notes?: string,
  thresholds?: Partial<PropertyVerificationThresholds> | null,
) {
  const effectiveThresholds = normalizeVerificationThresholds(thresholds);
  const verificationDueAt = addDays(now, effectiveThresholds.freshDays);

  return {
    lastVerifiedAt: now,
    verificationStatus: "VERIFIED" as const,
    verificationDueAt,
    isPubliclyVisible: true,
    autoHiddenAt: null,
    verificationNotes: notes?.trim() ? notes.trim() : null,
    verificationWarningSentAt: null,
    hiddenNotificationSentAt: null,
  };
}

function shouldSendVerificationDueAlert(
  property: PropertyVerificationRecord,
  thresholds?: Partial<PropertyVerificationThresholds> | null,
  now = new Date(),
) {
  const lastVerifiedAt = normalizeDate(property.lastVerifiedAt);
  const warningSentAt = normalizeDate(property.verificationWarningSentAt);
  if (!lastVerifiedAt || warningSentAt || property.status === "ARCHIVED") {
    return false;
  }

  const dueAt = normalizeDate(property.verificationDueAt) ?? lastVerifiedAt;
  const effectiveThresholds = normalizeVerificationThresholds(thresholds);
  return isAfter(dueAt, now) && isBefore(dueAt, addDays(now, effectiveThresholds.warningReminderDays));
}

function shouldSendHiddenAlert(property: PropertyVerificationRecord, nextState: ReturnType<typeof updateVerificationState>) {
  return (
    property.status !== "ARCHIVED" &&
    nextState.verificationStatus === "HIDDEN" &&
    !normalizeDate(property.hiddenNotificationSentAt)
  );
}

async function getAdminRecipients(companyId: string) {
  return prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      roles: {
        some: {
          role: {
            name: "ADMIN",
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
}

async function notifyVerificationDue(property: PropertyNotificationTarget) {
  const recipients = await getAdminRecipients(property.companyId);
  if (recipients.length === 0) {
    return;
  }

  const dueAt = normalizeDate(property.verificationDueAt) ?? new Date();
  await notifyManyUsers(recipients, {
    companyId: property.companyId,
    type: "PROPERTY_VERIFICATION_DUE",
    title: "Property verification due soon",
    body: `${property.title} needs to be re-verified by ${formatDate(dueAt, "PPP")}.`,
    metadata: {
      propertyId: property.id,
      dueAt: dueAt.toISOString(),
    } as Prisma.InputJsonValue,
    emailSubject: "Property verification due soon",
    emailHtml: (recipientName) =>
      `<p>Hi ${recipientName},</p><p>${property.title} is due for verification on ${formatDate(
        dueAt,
        "PPP",
      )}. Re-verify it before it becomes stale on the public site.</p>`,
  });
}

async function notifyPropertyHidden(property: Omit<PropertyNotificationTarget, "verificationDueAt">) {
  const recipients = await getAdminRecipients(property.companyId);
  if (recipients.length === 0) {
    return;
  }

  await notifyManyUsers(recipients, {
    companyId: property.companyId,
    type: "PROPERTY_HIDDEN",
    title: "Property hidden from public listings",
    body: `${property.title} was auto-hidden because the verification window expired.`,
    metadata: {
      propertyId: property.id,
    } as Prisma.InputJsonValue,
    emailSubject: "Property hidden from public listings",
    emailHtml: (recipientName) =>
      `<p>Hi ${recipientName},</p><p>${property.title} has been hidden from public listings because it was not re-verified in time.</p>`,
  });
}

export async function syncPropertyVerificationStates(input?: {
  companyId?: string | null;
  now?: Date;
}) {
  if (!featureFlags.hasDatabase) {
    return { updated: 0, hidden: 0, warned: 0 };
  }

  const now = input?.now ?? new Date();
  const properties = await prisma.property.findMany({
    where: input?.companyId ? { companyId: input.companyId } : undefined,
    select: {
      id: true,
      companyId: true,
      title: true,
      status: true,
      lastVerifiedAt: true,
      verificationStatus: true,
      verificationDueAt: true,
      isPubliclyVisible: true,
      autoHiddenAt: true,
      verificationWarningSentAt: true,
      hiddenNotificationSentAt: true,
    },
  });

  let updated = 0;
  let hidden = 0;
  let warned = 0;

  for (const property of properties) {
    const thresholds = await getVerificationThresholdsForCompany(property.companyId);
    const nextState = updateVerificationState(property, thresholds, now);
    const shouldWarn = shouldSendVerificationDueAlert(
      {
        ...property,
        verificationDueAt: nextState.verificationDueAt,
      },
      thresholds,
      now,
    );
    const shouldNotifyHidden = shouldSendHiddenAlert(property, nextState);
    const payload: Prisma.PropertyUpdateInput = {};

    if (property.verificationStatus !== nextState.verificationStatus) {
      payload.verificationStatus = nextState.verificationStatus;
    }

    if ((property.verificationDueAt?.getTime?.() ?? 0) !== nextState.verificationDueAt.getTime()) {
      payload.verificationDueAt = nextState.verificationDueAt;
    }

    if (Boolean(property.isPubliclyVisible) !== nextState.isPubliclyVisible) {
      payload.isPubliclyVisible = nextState.isPubliclyVisible;
    }

    if ((property.autoHiddenAt?.getTime?.() ?? 0) !== (nextState.autoHiddenAt?.getTime?.() ?? 0)) {
      payload.autoHiddenAt = nextState.autoHiddenAt;
    }

    if (shouldWarn) {
      payload.verificationWarningSentAt = now;
    }

    if (shouldNotifyHidden) {
      payload.hiddenNotificationSentAt = now;
    }

    if (Object.keys(payload).length > 0) {
      await prisma.property.update({
        where: {
          id: property.id,
        },
        data: payload,
      });
      updated += 1;
    }

    if (shouldWarn) {
      warned += 1;
      await notifyVerificationDue({
        id: property.id,
        title: property.title,
        companyId: property.companyId,
        verificationDueAt: nextState.verificationDueAt,
      });
    }

    if (shouldNotifyHidden) {
      hidden += 1;
      await notifyPropertyHidden({
        id: property.id,
        title: property.title,
        companyId: property.companyId,
      });
    }
  }

  return { updated, hidden, warned };
}
