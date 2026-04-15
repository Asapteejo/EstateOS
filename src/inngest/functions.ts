/**
 * Inngest function definitions for EstateOS background jobs.
 *
 * Scheduling overview
 * ───────────────────
 * • Hourly (top of hour)  → operational sweep
 *     – Payment overdue detection + buyer/operator emails
 *     – Inspection reminders (24 h window)
 *     – Wishlist follow-up alerts (staff)
 *     – Payment-request expiry sync
 *     – Property verification sync
 *     – Marketer ranking snapshots
 *     – Analytics daily snapshots
 *
 * • Daily 07:00 UTC       → wishlist reminder fan-out
 *     – Expires stale saved-properties
 *     – Finds items within 3-day expiry window with reminders enabled
 *     – Fans out one "wishlist/reminder.send" event per item so each
 *       reminder has independent retry semantics
 *
 * • Daily 08:00 UTC       → morning briefing fan-out
 *     – Fans out one "morning-briefing/company.send" event per active company
 *       that has ADMIN users; each company email is independently retried
 *
 * • Daily 09:00 UTC       → revenue recovery sweep
 *     – Advances overdue transactions through escalation stages 1–4
 *
 * Event-triggered
 * ───────────────
 * • automation/sweep.run           → same operational sweep (manual trigger)
 * • wishlist/reminder.send         → per-item reminder email + in-app notification
 * • morning-briefing/company.send  → digest email to ADMIN users for one company
 * • revenue-recovery/sweep.run     → revenue recovery sweep (manual trigger)
 * • property/verification.sync     → verification state sync for one company
 */

import { AppRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { inngest } from "@/lib/notifications/events";
import { renderMorningBriefingEmail } from "@/lib/notifications/templates";
import { runScheduledOperationalJobs } from "@/modules/automation/service";
import { getMorningBriefingData } from "@/modules/morning-briefing/aggregator";
import { syncPropertyVerificationStates } from "@/modules/properties/verification";
import { runRevenueRecoverySweep } from "@/modules/revenue-recovery/engine";
import {
  getWishlistReminderCandidates,
  sendWishlistReminder,
  syncExpiredWishlists,
} from "@/modules/wishlist/service";

export const notificationFunctions = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. OPERATIONAL SWEEP — hourly cron + manual event trigger
  //
  //    The sweep is intentionally kept as a single coordinated job rather
  //    than per-item fan-out so that the dedup mechanism in
  //    runScheduledOperationalJobs() (BackgroundJobLog) can prevent
  //    double-runs across manual API triggers and the cron.
  //
  //    retries: 1 — the sweep records its own BackgroundJobLog so a hard
  //    retry on failure is sufficient; aggressive retries would produce
  //    duplicate notifications.
  // ─────────────────────────────────────────────────────────────────────────
  inngest.createFunction(
    {
      id: "run-operational-automation-sweep",
      retries: 1,
      triggers: [
        { event: "automation/sweep.run" },
        { cron: "0 * * * *" }, // top of every hour UTC
      ],
    },
    async ({ event, step }) => {
      // event.data is BasicDataAny | CronEventData — cast to extract optional fields
      const data = event.data as Record<string, unknown>;
      return step.run("execute-sweep", () =>
        runScheduledOperationalJobs({
          // companyId only present for manual event triggers; undefined for cron
          companyId: typeof data.companyId === "string" ? data.companyId : undefined,
          // Pass the Inngest event ID so the dedup check can key on it
          eventKey: typeof event.id === "string" ? event.id : null,
          source: "inngest",
        }),
      );
    },
  ),

  // ─────────────────────────────────────────────────────────────────────────
  // 2. WISHLIST REMINDER FAN-OUT — daily at 07:00 UTC
  //
  //    Step 1 (find-and-expire): atomically mark expired wishlists and
  //    collect items entering the 3-day reminder window.
  //
  //    Step 2 (dispatch-reminders): fan out one "wishlist/reminder.send"
  //    event per candidate so that each buyer email is independently
  //    retried by function #3 if delivery fails. Inngest memoises
  //    completed steps, so re-runs of this function after a partial
  //    failure won't re-dispatch already-dispatched events.
  //
  //    retries: 2 — if Prisma is unavailable the step will be retried
  //    before giving up on the whole batch.
  // ─────────────────────────────────────────────────────────────────────────
  inngest.createFunction(
    {
      id: "scheduled-wishlist-reminder-fanout",
      retries: 2,
      triggers: [{ cron: "0 7 * * *" }], // 07:00 UTC daily
    },
    async ({ step }) => {
      const candidates = await step.run("find-and-expire-wishlists", async () => {
        await syncExpiredWishlists();
        return getWishlistReminderCandidates();
      });

      if (candidates.length === 0) {
        return { fanned: 0 };
      }

      await step.sendEvent(
        "dispatch-wishlist-reminders",
        candidates.map((c) => ({
          name: "wishlist/reminder.send" as const,
          data: { savedPropertyId: c.id },
        })),
      );

      return { fanned: candidates.length };
    },
  ),

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PER-ITEM WISHLIST REMINDER — event triggered
  //
  //    Handles one saved-property reminder: eligibility re-check (in case
  //    the buyer cancelled between fan-out and delivery), email send,
  //    in-app notification, and reminderSentAt stamp.
  //
  //    retries: 3 — transient email delivery failures should resolve
  //    within a few attempts without user impact.
  // ─────────────────────────────────────────────────────────────────────────
  inngest.createFunction(
    {
      id: "send-wishlist-reminder-email",
      retries: 3,
      triggers: [{ event: "wishlist/reminder.send" }],
    },
    async ({ event, step }) => {
      if (typeof event.data.savedPropertyId !== "string") {
        return { skipped: true, reason: "missing-id" };
      }

      return step.run("send-reminder", () =>
        sendWishlistReminder(event.data.savedPropertyId as string),
      );
    },
  ),

  // ─────────────────────────────────────────────────────────────────────────
  // 4. REVENUE RECOVERY SWEEP — daily at 09:00 UTC + manual event trigger
  //
  //    Walks all OVERDUE transactions and advances each one to the next
  //    escalation stage (day 1 → day 3 → day 7 → day 14) based on how
  //    long ago nextPaymentDueAt passed.
  //
  //    Each transaction advances at most one stage per run — the
  //    overdueReminderStage high-water mark prevents re-sends.
  //
  //    retries: 1 — the stage field ensures idempotency; aggressive
  //    retries would not produce duplicate sends but a single retry is
  //    sufficient for transient DB / email failures.
  // ─────────────────────────────────────────────────────────────────────────
  inngest.createFunction(
    {
      id: "run-revenue-recovery-sweep",
      retries: 1,
      triggers: [
        { event: "revenue-recovery/sweep.run" },
        { cron: "0 9 * * *" }, // 09:00 UTC daily
      ],
    },
    async ({ event, step }) => {
      const data = event.data as Record<string, unknown>;
      return step.run("execute-recovery", () =>
        runRevenueRecoverySweep({
          companyId: typeof data.companyId === "string" ? data.companyId : undefined,
        }),
      );
    },
  ),

  // ─────────────────────────────────────────────────────────────────────────
  // 5. MORNING BRIEFING FAN-OUT — daily at 08:00 UTC
  //
  //    Fetches every active company that has at least one ADMIN user with an
  //    email address, then fans out one "morning-briefing/company.send" event
  //    per company. Each per-company delivery is independently retried so a
  //    single bad company record can't block all briefings.
  //
  //    retries: 1 — fan-out itself is idempotent; the child events carry the
  //    retry burden.
  // ─────────────────────────────────────────────────────────────────────────
  inngest.createFunction(
    {
      id: "send-morning-briefing-fanout",
      retries: 1,
      triggers: [{ cron: "0 8 * * *" }], // 08:00 UTC daily
    },
    async ({ step }) => {
      const companies = await step.run("find-briefing-companies", async () => {
        if (!featureFlags.hasDatabase) return [];

        // Only include companies that have at least one active ADMIN with an email.
        return prisma.company.findMany({
          where: {
            isActive: true,
            users: {
              some: {
                isActive: true,
                email: { not: null },
                roles: {
                  some: {
                    role: { name: "ADMIN" satisfies AppRole },
                  },
                },
              },
            },
          },
          select: { id: true },
        });
      });

      if (companies.length === 0) {
        return { fanned: 0 };
      }

      await step.sendEvent(
        "dispatch-company-briefings",
        companies.map((c) => ({
          name: "morning-briefing/company.send" as const,
          data: { companyId: c.id },
        })),
      );

      return { fanned: companies.length };
    },
  ),

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PER-COMPANY MORNING BRIEFING — event triggered
  //
  //    Aggregates the four digest sections for one company and emails every
  //    ADMIN user. Two steps keep the aggregation and delivery observable
  //    and independently retried in Inngest's dashboard.
  //
  //    retries: 2 — transient DB or Resend failures should resolve on retry
  //    without user impact.
  // ─────────────────────────────────────────────────────────────────────────
  inngest.createFunction(
    {
      id: "send-morning-briefing-for-company",
      retries: 2,
      triggers: [{ event: "morning-briefing/company.send" }],
    },
    async ({ event, step }) => {
      if (typeof event.data.companyId !== "string") {
        return { skipped: true, reason: "missing-company-id" };
      }

      const companyId = event.data.companyId;

      const briefing = await step.run("aggregate-briefing-data", () =>
        getMorningBriefingData(companyId),
      );

      const sent = await step.run("send-briefing-emails", async () => {
        if (!featureFlags.hasDatabase) return { sent: 0 };

        const admins = await prisma.user.findMany({
          where: {
            companyId,
            isActive: true,
            email: { not: null },
            roles: {
              some: {
                role: { name: "ADMIN" satisfies AppRole },
              },
            },
          },
          select: { email: true, firstName: true },
        });

        let count = 0;
        for (const admin of admins) {
          if (!admin.email) continue;
          const { subject, html } = renderMorningBriefingEmail({
            ...briefing,
            recipientName: admin.firstName ?? "there",
          });
          await sendTransactionalEmail({ to: admin.email, subject, html });
          count += 1;
        }
        return { sent: count };
      });

      return { companyId, ...sent };
    },
  ),

  // ─────────────────────────────────────────────────────────────────────────
  // 7. PROPERTY VERIFICATION SYNC — event triggered
  //
  //    Syncs verification states for one company (or all companies when
  //    companyId is omitted). Called from admin UI after bulk edits.
  // ─────────────────────────────────────────────────────────────────────────
  inngest.createFunction(
    {
      id: "sync-property-verification",
      triggers: [{ event: "property/verification.sync" }],
    },
    async ({ event, step }) => {
      return step.run("sync-verification", () =>
        syncPropertyVerificationStates({
          companyId:
            typeof event.data.companyId === "string"
              ? event.data.companyId
              : undefined,
        }),
      );
    },
  ),
];
