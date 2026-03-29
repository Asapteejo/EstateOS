import { Inngest } from "inngest";

import { env } from "@/lib/env";

export const inngest = new Inngest({
  id: "acme-realty",
  eventKey: env.INNGEST_EVENT_KEY,
});

export async function publishDomainEvent<
  TName extends
    | "inquiry/received"
    | "inspection/booked"
    | "reservation/created"
    | "payment/confirmed"
    | "document/requested"
    | "milestone/updated",
>(name: TName, data: Record<string, unknown>) {
  if (!env.INNGEST_EVENT_KEY) {
    return { id: `demo-${name}` };
  }

  return inngest.send({
    name,
    data,
  });
}
