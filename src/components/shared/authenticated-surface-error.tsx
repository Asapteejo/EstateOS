"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { captureClientException } from "@/lib/integrations/posthog-client";
import { captureException } from "@/lib/sentry";

export function AuthenticatedSurfaceError({
  error,
  reset,
  surface,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  surface: "admin" | "portal" | "superadmin";
}) {
  useEffect(() => {
    captureException(error);
    void captureClientException(error, {
      source: "authenticated-surface-error-boundary",
      route: `/${surface}`,
      component: "AuthenticatedSurfaceError",
      digest: error.digest,
    }, {
      severity: "HIGH",
      source: "client",
    });
  }, [error, surface]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--ink-950)]">Workspace temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
          EstateOS could not load this workspace. Retry the request while the server-side diagnostic log is reviewed.
        </p>
        <Button className="mt-6" onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}

