import type { NextConfig } from "next";

/**
 * Content-Security-Policy — REPORT-ONLY (not enforced).
 *
 * This is intentionally shipped as `Content-Security-Policy-Report-Only` so the
 * browser REPORTS violations (visible in DevTools → Console / Network) WITHOUT
 * blocking anything. Nothing here can break the live app. The goal is to observe
 * what real traffic actually loads/connects to for a while, tune this allowlist
 * to remove anything unused and add anything missing, and only THEN switch the
 * header key to `Content-Security-Policy` to enforce it.
 *
 * Allowlist is derived from the third-party services the app actually uses:
 *   - Clerk           (auth UI + FAPI + Cloudflare Turnstile bot challenge)
 *   - Paystack        (inline checkout script + API + checkout iframe)
 *   - Mapbox GL JS     (bundled script; loads tiles/styles + uses blob workers)
 *   - PostHog          (custom fetch client → NEXT_PUBLIC_POSTHOG_HOST/capture/)
 *   - Sentry           (bundled SDK; sends events to *.ingest.sentry.io)
 *   - Cloudflare R2    (browser presigned PUT/GET to *.r2.cloudflarestorage.com)
 *   - Unsplash         (marketing imagery)
 *   - Vercel           (vercel.live preview toolbar on preview deployments)
 * Server-only integrations (Gemini, Resend, Twilio) never touch the browser, so
 * they need no CSP entries.
 *
 * KNOWN LOOSENESS to tighten before enforcement:
 *   - script-src includes 'unsafe-inline' and 'unsafe-eval'. Next.js/React inject
 *     inline bootstrap scripts and this config cannot emit a per-request nonce
 *     (static headers only). Before enforcing, move to a nonce-based script-src
 *     with 'strict-dynamic' (requires middleware) and drop 'unsafe-eval'.
 *   - style-src includes 'unsafe-inline' for Tailwind/inline styles + Mapbox.
 *
 * NOTE: if the production Clerk instance uses a custom FAPI domain
 * (e.g. https://clerk.your-domain.com), add it to script-src and connect-src.
 */
const contentSecurityPolicyReportOnly = [
  // Lock everything down by default; specific resource types are opened up below.
  "default-src 'self'",
  // Scripts: self + inline/eval (see looseness note) + external SDK script hosts.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://js.paystack.co https://vercel.live",
  // Some browsers consult script-src-elem/attr separately; keep them aligned.
  "script-src-elem 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://js.paystack.co https://vercel.live",
  // Styles: Tailwind + inline style attributes + Mapbox-injected styles.
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self' 'unsafe-inline'",
  // Images: self, data/blob URIs, Unsplash, R2 media, Clerk avatars, Mapbox tiles.
  "img-src 'self' data: blob: https://images.unsplash.com https://*.r2.cloudflarestorage.com https://img.clerk.com https://*.clerk.com https://api.mapbox.com https://*.tiles.mapbox.com",
  // Fonts: self-hosted + data URIs (no Google Fonts CDN is used).
  "font-src 'self' data:",
  // XHR/fetch/websocket targets: own origin + every third-party API the browser calls.
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com https://api.paystack.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.posthog.com https://*.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://*.r2.cloudflarestorage.com https://vercel.live wss://ws-us3.pusher.com",
  // Iframes the app embeds: Clerk components, Cloudflare Turnstile, Paystack checkout, Vercel toolbar.
  "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://checkout.paystack.com https://*.paystack.com https://vercel.live",
  // Web/Service workers (Mapbox GL spawns blob: workers).
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // Media (audio/video) — self + blob + presigned R2 objects.
  "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
  // App manifest.
  "manifest-src 'self'",
  // Form submissions only to our own origin (+ Paystack redirect target, defensively).
  "form-action 'self' https://checkout.paystack.com",
  // Who may frame us — mirrors the existing X-Frame-Options: SAMEORIGIN header.
  "frame-ancestors 'self'",
  // Restrict <base> and disallow plugins.
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Report-only: surfaces CSP violations in DevTools without blocking.
          // Monitor reports and tune the allowlist before switching this to the
          // enforcing "Content-Security-Policy" header (see note above).
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicyReportOnly,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
