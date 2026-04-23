"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { captureClientException } from "@/lib/integrations/posthog-client";
import { captureException } from "@/lib/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
    void captureClientException(error, {
      source: "global-error-boundary",
    }, {
      severity: "HIGH",
      source: "client",
    });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold text-[var(--ink-950)]">Something went wrong</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-600)]">
          The error has been captured. Retry the request or reload the page.
        </p>
        <div className="mt-6">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
