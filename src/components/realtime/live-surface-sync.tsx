"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

type LiveSurfaceSyncProps = {
  channel: "company" | "superadmin";
  surface?: "admin" | "portal";
};

export function LiveSurfaceSync({ channel, surface = "admin" }: LiveSurfaceSyncProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < 1500 || isPending) {
        return;
      }
      lastRefreshRef.current = now;
      startTransition(() => {
        router.refresh();
      });
    };

    const search = new URLSearchParams({
      channel,
      ...(channel === "company" ? { surface } : {}),
    });
    const source = new EventSource(`/api/realtime/stream?${search.toString()}`);
    const fallback = window.setInterval(refresh, 30000);

    source.addEventListener("message", refresh);
    source.addEventListener("ready", () => undefined);
    source.addEventListener("ping", () => undefined);
    source.onerror = () => {
      refresh();
    };

    return () => {
      window.clearInterval(fallback);
      source.close();
    };
  }, [channel, router, surface, isPending]);

  return null;
}
