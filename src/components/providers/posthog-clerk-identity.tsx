"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

import { setPostHogClientIdentity } from "@/lib/integrations/posthog-client";
import { clientFlags } from "@/lib/public-env";

export function PostHogClerkIdentity() {
  const { userId } = useAuth();

  useEffect(() => {
    if (!clientFlags.hasPostHog) {
      return;
    }

    setPostHogClientIdentity({ userId: userId ?? null });
  }, [userId]);

  return null;
}
