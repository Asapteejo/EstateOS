import { Inngest } from "inngest";

import { env, featureFlags } from "@/lib/env";

export const inngest = new Inngest({
  id: `estateos-${env.DEFAULT_COMPANY_SLUG ?? "app"}`,
  eventKey: env.INNGEST_EVENT_KEY,
});

export async function publishDomainEvent<
  TName extends
    | "inquiry/received"
    | "inspection/booked"
    | "property/verification.sync"
    | "wishlist/reminder.send"
    | "reservation/created"
    | "payment/confirmed"
    | "document/requested"
    | "milestone/updated"
    | "automation/sweep.run",
>(name: TName, data: Record<string, unknown>) {
  if (!featureFlags.hasInngest) {
    return { id: `demo-${name}` };
  }

  return inngest.send({
    name,
    data,
  });
}
