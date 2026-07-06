"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS,
  REALTIME_VERSION_POLL_INTERVAL_MS,
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
    const refresh = (minIntervalMs?: number) => {
      const now = Date.now();
      if (!shouldRefreshRealtime({
        now,
        lastRefreshAt: lastRefreshRef.current,
        hidden: document.hidden,
        pending: pendingRef.current,
        minIntervalMs,
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

    // ── Conditional polling ──────────────────────────────────────────────
    // Instead of blindly re-rendering every interval, poll the tiny
    // /api/realtime/version endpoint (one Redis GET server-side) and only
    // call router.refresh() when the change counter actually moved. Falls
    // back to the old blind refresh when the counter backplane is
    // unavailable (no Redis) or the endpoint errors — shouldRefreshRealtime
    // still rate-limits blind refreshes to the 30s cadence.
    const versionSearch = new URLSearchParams({
      channel,
      ...(channel === "company" ? { surface } : {}),
    });
    let lastVersion: number | null = null;
    let counterEnabled: boolean | null = null; // null = not yet probed

    const pollTick = async () => {
      if (cancelled || document.hidden || pendingRef.current) {
        return;
      }

      if (counterEnabled === false) {
        refresh();
        return;
      }

      try {
        const response = await fetch(`/api/realtime/version?${versionSearch.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Version check failed (${response.status}).`);
        }
        const payload = (await response.json()) as {
          data?: { enabled?: boolean; version?: number | null };
        };
        if (cancelled) return;

        if (!payload.data?.enabled || typeof payload.data.version !== "number") {
          counterEnabled = false;
          refresh();
          return;
        }

        counterEnabled = true;
        if (lastVersion === null) {
          // First probe: remember the baseline, nothing to refresh yet.
          lastVersion = payload.data.version;
          return;
        }
        if (payload.data.version !== lastVersion) {
          lastVersion = payload.data.version;
          // A real change was detected — refresh promptly (short debounce
          // floor rather than the 30s blind-poll spacing).
          refresh(REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS);
        }
      } catch {
        // Endpoint unreachable — degrade to blind refresh (rate-limited).
        refresh();
      }
    };

    const startPolling = () => {
      if (pollingInterval != null) return;
      void pollTick();
      pollingInterval = window.setInterval(() => void pollTick(), REALTIME_VERSION_POLL_INTERVAL_MS);
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
        source.addEventListener("message", () => refresh(REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS));
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
