"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  REALTIME_REFRESH_INTERVAL_MS,
  shouldRefreshRealtime,
} from "@/lib/realtime/refresh-policy";

type LiveSurfaceSyncProps = {
  channel: "company" | "superadmin";
  surface?: "admin" | "portal";
};

export function LiveSurfaceSync({ channel, surface = "admin" }: LiveSurfaceSyncProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastRefreshRef = useRef(0);
  const pendingRef = useRef(isPending);

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (!shouldRefreshRealtime({
        now,
        lastRefreshAt: lastRefreshRef.current,
        hidden: document.hidden,
        pending: pendingRef.current,
      })) {
        return;
      }
      lastRefreshRef.current = now;
      startTransition(() => {
        router.refresh();
      });
    };

    let source: EventSource | null = null;
    let pollingInterval: number | null = null;
    let cancelled = false;

    const startPolling = () => {
      if (pollingInterval != null) return;
      pollingInterval = window.setInterval(refresh, REALTIME_REFRESH_INTERVAL_MS);
    };

    void fetch("/api/realtime/config")
      .then((response) => response.json())
      .then((payload: { realtimeTransport?: string }) => {
        if (cancelled || payload.realtimeTransport !== "sse") {
          startPolling();
          return;
        }

        const search = new URLSearchParams({
          channel,
          ...(channel === "company" ? { surface } : {}),
        });
        source = new EventSource(`/api/realtime/stream?${search.toString()}`);
        source.addEventListener("message", refresh);
        source.addEventListener("ready", () => undefined);
        source.addEventListener("ping", () => undefined);
        source.onerror = () => {
          source?.close();
          source = null;
          startPolling();
        };
      })
      .catch(startPolling);

    return () => {
      cancelled = true;
      if (pollingInterval != null) {
        window.clearInterval(pollingInterval);
      }
      source?.close();
    };
  }, [channel, router, surface]);

  return null;
}
