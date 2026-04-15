import { Inngest } from "inngest";

import { env, featureFlags } from "@/lib/env";

export const inngest = new Inngest({
  id: "estateos-platform",
  eventKey: env.INNGEST_EVENT_KEY,
});

export async function publishDomainEvent<
  TName extends
    | "inquiry/received"
    | "inspection/booked"
    | "inspection/reminder.send"
    | "property/verification.sync"
    | "wishlist/reminder.send"
    | "reservation/created"
    | "payment/confirmed"
    | "payment/overdue.check"
    | "document/requested"
    | "milestone/updated"
    | "automation/sweep.run"
    | "revenue-recovery/sweep.run"
    | "morning-briefing/company.send",
>(name: TName, data: Record<string, unknown>) {
  if (!featureFlags.hasInngest) {
    return { id: `demo-${name}` };
  }

  return inngest.send({
    name,
    data,
  });
}
