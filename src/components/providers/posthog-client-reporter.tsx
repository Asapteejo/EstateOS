"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  captureClientException,
  installPostHogClientTestHelpers,
} from "@/lib/integrations/posthog-client";
import { clientFlags } from "@/lib/public-env";

export function PostHogClientReporter() {
  const pathname = usePathname();

  useEffect(() => {
    if (!clientFlags.hasPostHog) {
      return;
    }

    const onError = (event: ErrorEvent) => {
      void captureClientException(event.error ?? new Error(event.message), {
        source: "window.error",
        appArea: pathname,
      }, {
        source: "client",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      void captureClientException(event.reason, {
        source: "window.unhandledrejection",
        appArea: pathname,
      }, {
        source: "client",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    if (process.env.NODE_ENV !== "production") {
      installPostHogClientTestHelpers(pathname);
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      if (process.env.NODE_ENV !== "production") {
        delete window.__estateosPosthogTest;
      }
    };
  }, [pathname]);

  return null;
}
