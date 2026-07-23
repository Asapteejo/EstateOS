/**
 * Content-Security-Policy — ENFORCED, nonce-based.
 *
 * History: the CSP shipped as `Content-Security-Policy-Report-Only` from
 * next.config.ts (static headers) starting 2026-06 so real traffic could be
 * observed without breaking anything. This module is the enforcement step:
 * the proxy (src/proxy.ts) generates a fresh nonce per request, forwards it to
 * Next.js via the `content-security-policy` request header (Next reads the
 * nonce from there and applies it to its own inline/bootstrap scripts), and
 * sets the enforced response header.
 *
 * How the script-src works across browser generations:
 *   - CSP3 browsers see `'nonce-…' 'strict-dynamic'` → only nonced scripts run,
 *     and scripts they inject at runtime (Clerk's clerk-js, Mapbox workers,
 *     PostHog) inherit trust. Host allowlist + 'unsafe-inline' are IGNORED.
 *   - CSP2 browsers ignore 'strict-dynamic' → fall back to nonce + host
 *     allowlist ('unsafe-inline' is ignored because a nonce is present).
 *   - CSP1 browsers see 'unsafe-inline' + host allowlist → behave like the old
 *     report-only policy. Nothing breaks.
 *
 * The one static inline script in the app (the pre-hydration theme snippet in
 * src/app/layout.tsx) is authorized by SHA-256 hash instead of a nonce so the
 * root layout can stay static. The snippet text lives here (THEME_INIT_SCRIPT)
 * and layout.tsx imports it; csp.test.ts verifies the hash matches the text,
 * so the two can never drift apart silently.
 *
 * Escape hatch: set ESTATEOS_CSP_REPORT_ONLY=true to fall back to a
 * report-only header (e.g. on a Vercel preview if the toolbar misbehaves).
 *
 * Allowlist is derived from the third-party services the app actually uses:
 * Clerk, Paystack, Mapbox, PostHog, Sentry, Cloudflare R2, Unsplash, Vercel
 * preview toolbar. Server-only integrations (Gemini, Resend, Twilio) never
 * touch the browser, so they need no CSP entries.
 */

/**
 * Pre-hydration theme bootstrap. Runs before paint so users who chose the
 * dark theme — or whose SYSTEM is dark and who haven't chosen anything —
 * don't get a light-mode flash. An explicit stored choice ("dark"/"light")
 * always wins over prefers-color-scheme. Rendered in src/app/layout.tsx.
 *
 * IMPORTANT: if you edit this string you MUST update THEME_INIT_SCRIPT_HASH
 * (`printf %s "<script>" | openssl dgst -sha256 -binary | openssl base64`).
 * csp.test.ts fails loudly if they don't match.
 */
export const THEME_INIT_SCRIPT =
  "(function(){try{var s=localStorage.getItem('estateos-theme');if(s==='dark'||(!s&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('theme-dark');}}catch(e){}})();";

export const THEME_INIT_SCRIPT_HASH =
  "sha256-w5CLdwY1rvtdOOogyHdhic7hvIwyqw6GFGkVfA4nRDU=";

/**
 * Clerk PRODUCTION Frontend API custom domain. Clerk production instances serve
 * their FAPI from `clerk.<primary-domain>` (here clerk.estateos.tech), which is
 * NOT covered by the *.clerk.accounts.dev / *.clerk.com dev patterns. Without it
 * the browser blocks every Clerk sign-in request and login silently fails.
 */
const CLERK_PROD_DOMAIN = "https://clerk.estateos.tech";

/** Hosts that may serve <script src> (CSP2 fallback; ignored under strict-dynamic). */
const SCRIPT_HOSTS =
  `https://*.clerk.accounts.dev https://*.clerk.com ${CLERK_PROD_DOMAIN} https://challenges.cloudflare.com https://js.paystack.co https://vercel.live`;

/**
 * Generates a random base64 nonce. Edge-runtime safe (Web Crypto + btoa are
 * available in both the edge and Node runtimes).
 */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Extracts the hostname from R2_PUBLIC_BASE_URL (or any base URL) for the
 * img-src/media-src allowlist. Returns null when unset/invalid.
 */
export function resolveMediaHost(baseUrl: string | undefined | null): string | null {
  if (!baseUrl) {
    return null;
  }
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * Builds the full policy string for one request.
 *
 * `allowUnsafeEval` exists for non-production runtimes only (React Fast
 * Refresh / dev tooling evals). Production policies must never include it.
 * `mediaHost` is the tenant media domain (from R2_PUBLIC_BASE_URL) so
 * unoptimized/direct image and video loads from it aren't blocked.
 */
export function buildContentSecurityPolicy(options: {
  nonce: string;
  allowUnsafeEval?: boolean;
  mediaHost?: string | null;
}): string {
  const { nonce, allowUnsafeEval = false, mediaHost = null } = options;
  const evalSource = allowUnsafeEval ? " 'unsafe-eval'" : "";
  const scriptSrc = `'self' 'nonce-${nonce}' 'strict-dynamic' '${THEME_INIT_SCRIPT_HASH}' 'unsafe-inline'${evalSource} ${SCRIPT_HOSTS}`;
  const mediaHostSource = mediaHost ? ` https://${mediaHost}` : "";

  return [
    // Lock everything down by default; specific resource types are opened up below.
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Some browsers consult script-src-elem separately; keep it aligned.
    `script-src-elem ${scriptSrc}`,
    // Styles: Tailwind + inline style attributes + Mapbox-injected styles.
    "style-src 'self' 'unsafe-inline'",
    "style-src-elem 'self' 'unsafe-inline'",
    // Images: self, data/blob URIs, Unsplash, R2 media (presigned + public
    // bucket domains + configured tenant media domain), Clerk avatars, Mapbox tiles.
    `img-src 'self' data: blob: https://images.unsplash.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://img.clerk.com https://*.clerk.com https://api.mapbox.com https://*.tiles.mapbox.com${mediaHostSource}`,
    // Fonts: self-hosted (next/font) + data URIs. No external font CDN at runtime.
    "font-src 'self' data:",
    // XHR/fetch/websocket targets: own origin + every third-party API the browser calls.
    `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com ${CLERK_PROD_DOMAIN} https://clerk-telemetry.com https://api.paystack.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.posthog.com https://*.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://*.r2.cloudflarestorage.com https://vercel.live wss://ws-us3.pusher.com`,
    // Iframes the app embeds: Clerk components, Cloudflare Turnstile, Paystack checkout, Vercel toolbar.
    `frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com ${CLERK_PROD_DOMAIN} https://challenges.cloudflare.com https://checkout.paystack.com https://*.paystack.com https://vercel.live`,
    // Web/Service workers (Mapbox GL spawns blob: workers).
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    // Media (audio/video) — self + blob + R2 objects (presigned, public
    // bucket domains, and the configured tenant media domain).
    `media-src 'self' blob: https://*.r2.cloudflarestorage.com https://*.r2.dev${mediaHostSource}`,
    // App manifest.
    "manifest-src 'self'",
    // Form submissions only to our own origin (+ Paystack redirect target, defensively).
    "form-action 'self' https://checkout.paystack.com",
    // Who may frame us — mirrors the X-Frame-Options: SAMEORIGIN header.
    "frame-ancestors 'self'",
    // Restrict <base> and disallow plugins.
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}
