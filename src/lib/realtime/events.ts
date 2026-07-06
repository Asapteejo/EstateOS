import { EventEmitter } from "node:events";

import { bumpChangeCounters } from "@/lib/realtime/change-counter";

type RealtimeScope = "platform" | "company";

export type PlatformRealtimeEvent = {
  id: string;
  scope: RealtimeScope;
  companyId?: string | null;
  name:
    | "payment.completed"
    | "payment.request.sent"
    | "deal.created"
    | "deal.updated"
    | "overdue.detected"
    | "followup.updated"
    | "notification.created"
    | "company.created"
    | "company.status.updated";
  summary: string;
  amount?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const GLOBAL_REALTIME_KEY = "__estateos_realtime_bus__";

function getRealtimeBus() {
  const globalWithBus = globalThis as typeof globalThis & {
    [GLOBAL_REALTIME_KEY]?: EventEmitter;
  };

  if (!globalWithBus[GLOBAL_REALTIME_KEY]) {
    globalWithBus[GLOBAL_REALTIME_KEY] = new EventEmitter();
    globalWithBus[GLOBAL_REALTIME_KEY]!.setMaxListeners(100);
  }

  return globalWithBus[GLOBAL_REALTIME_KEY]!;
}

function buildEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function publishRealtimeEvent(
  input: Omit<PlatformRealtimeEvent, "id" | "createdAt"> & { createdAt?: string },
) {
  const event: PlatformRealtimeEvent = {
    id: buildEventId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input,
  };

  getRealtimeBus().emit("platform-event", event);
  // Cross-instance signal for conditional polling: bump the per-company and
  // platform change counters in Redis. Fire-and-forget — publishing an event
  // must never fail or slow down the mutation that triggered it (the bump
  // catches internally and degrades to blind polling on the client).
  void bumpChangeCounters(event.companyId);
  return event;
}

export function subscribeRealtimeEvents(listener: (event: PlatformRealtimeEvent) => void) {
  const bus = getRealtimeBus();
  bus.on("platform-event", listener);

  return () => {
    bus.off("platform-event", listener);
  };
}
