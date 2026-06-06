"use client";

import { useEffect } from "react";

import { captureClientException } from "@/lib/integrations/posthog-client";
import { captureException } from "@/lib/sentry";

/**
 * Root global error boundary.
 *
 * `global-error.tsx` only renders when the ROOT layout itself throws, which
 * means the app's normal layout, providers, and (critically) globals.css are
 * NOT applied. It must therefore render its own <html>/<body> and rely on inline
 * styles only — design tokens/Tailwind classes are unavailable here. Styling is
 * kept intentionally minimal and on-brand (the same sand/ink palette values used
 * in globals.css) so it still reads as part of the product.
 *
 * The page-level boundaries (src/app/error.tsx and the per-surface error.tsx
 * files) handle the common case; this is the last-resort catch-all.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
    void captureClientException(
      error,
      { source: "root-global-error-boundary" },
      { severity: "HIGH", source: "client" },
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "linear-gradient(180deg, #fcfbf7, #f8f6f0 35%, #f4f1e8)",
          color: "#0f1720",
          fontFamily:
            'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 600, color: "#07111b", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "1rem", fontSize: "0.875rem", lineHeight: 1.75, color: "#475569" }}>
            We hit an unexpected error and the page couldn&apos;t load. The issue has
            been reported to our team. You can try again or reload the page.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                appearance: "none",
                cursor: "pointer",
                border: "none",
                borderRadius: "0.75rem",
                padding: "0.7rem 1.4rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#ffffff",
                background: "#0e5b49",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
