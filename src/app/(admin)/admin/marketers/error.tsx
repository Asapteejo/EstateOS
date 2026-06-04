"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { captureClientException } from "@/lib/integrations/posthog-client";
import { captureException } from "@/lib/sentry";

export default function AdminMarketersError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(props.error);
    void captureClientException(
      props.error,
      {
        source: "admin-marketers-error-boundary",
        route: "/admin/marketers",
        component: "AdminMarketersError",
        digest: props.error.digest,
      },
      {
        severity: "HIGH",
        source: "client",
      },
    );
  }, [props.error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--ink-950)]">
          Marketers dashboard temporarily unavailable
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
          EstateOS could not load marketer performance. Retry the request while the server-side diagnostic log is reviewed.
        </p>
        {props.error.digest ? (
          <p className="mt-4 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink-500)]">
            Error digest: <span className="font-mono">{props.error.digest}</span>
          </p>
        ) : null}
        <Button className="mt-6" onClick={() => props.reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
