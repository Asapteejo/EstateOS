export type RealtimeTransport = "polling" | "sse" | "auto";
export type RealtimeBackplane = "polling" | "process" | "redis";

export function resolveRealtimeRuntimeStatus(input: {
  configuredTransport?: RealtimeTransport | null;
  nodeEnv: string;
  redisConfigured: boolean;
}) {
  const requestedTransport = input.configuredTransport ?? "polling";
  const realtimeTransport =
    requestedTransport === "auto"
      ? input.nodeEnv === "production"
        ? "polling"
        : "sse"
      : requestedTransport;

  return {
    redisConfigured: input.redisConfigured,
    requestedTransport,
    realtimeTransport,
    realtimeBackplane: realtimeTransport === "polling" ? "polling" : "process",
  } satisfies {
    redisConfigured: boolean;
    requestedTransport: RealtimeTransport;
    realtimeTransport: Exclude<RealtimeTransport, "auto">;
    realtimeBackplane: RealtimeBackplane;
  };
}
