import { inngest } from "@/lib/notifications/events";
import { sendTransactionalEmail } from "@/lib/notifications/email";

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
];
