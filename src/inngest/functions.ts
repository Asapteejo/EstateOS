import { inngest } from "@/lib/notifications/events";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { runScheduledOperationalJobs } from "@/modules/automation/service";
import { syncPropertyVerificationStates } from "@/modules/properties/verification";
import { sendWishlistReminder } from "@/modules/wishlist/service";

export const notificationFunctions = [
  inngest.createFunction(
    { id: "send-inquiry-received-email", triggers: [{ event: "inquiry/received" }] },
    async ({ event }) => {
      if (typeof event.data.email !== "string") {
        return { skipped: true };
      }

      await sendTransactionalEmail({
        to: event.data.email,
        subject: "We received your inquiry",
        html: `<p>Hi ${event.data.fullName ?? "there"}, your inquiry has been received.</p>`,
      });

      return { delivered: true };
    },
  ),
  inngest.createFunction(
    { id: "sync-property-verification", triggers: [{ event: "property/verification.sync" }] },
    async ({ event }) => {
      return syncPropertyVerificationStates({
        companyId: typeof event.data.companyId === "string" ? event.data.companyId : undefined,
      });
    },
  ),
  inngest.createFunction(
    { id: "send-wishlist-reminder-email", triggers: [{ event: "wishlist/reminder.send" }] },
    async ({ event }) => {
      if (typeof event.data.savedPropertyId !== "string") {
        return { skipped: true };
      }

      return sendWishlistReminder(event.data.savedPropertyId);
    },
  ),
  inngest.createFunction(
    { id: "run-operational-automation-sweep", triggers: [{ event: "automation/sweep.run" }] },
    async ({ event }) => {
      return runScheduledOperationalJobs({
        companyId: typeof event.data.companyId === "string" ? event.data.companyId : undefined,
        eventKey: typeof event.id === "string" ? event.id : null,
        source: "inngest",
      });
    },
  ),
];
