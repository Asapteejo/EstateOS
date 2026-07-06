import type { NextConfig } from "next";

/**
 * Content-Security-Policy is ENFORCED and lives in src/proxy.ts +
 * src/lib/security/csp.ts (a static header cannot carry a per-request nonce,
 * so it moved out of this file). The previous report-only phase (2026-06)
 * informed the allowlist there. Only nonce-free security headers remain below.
 *
 * Escape hatch: ESTATEOS_CSP_REPORT_ONLY=true reverts to a report-only header.
 */
/**
 * Host of the public R2 media domain (custom domain or *.r2.dev), derived at
 * build time from R2_PUBLIC_BASE_URL. Used twice:
 *  - added to images.remotePatterns so next/image may optimize R2 media;
 *  - inlined into the client bundle (NEXT_PUBLIC_R2_PUBLIC_HOST) so
 *    shouldUseUnoptimizedImage() can whitelist the same host.
 * Presigned *.r2.cloudflarestorage.com URLs are intentionally NOT optimized:
 * their signatures change per request (cache-busting) and can expire before
 * the optimizer fetches them.
 */
const r2PublicHost = (() => {
  try {
    return process.env.R2_PUBLIC_BASE_URL
      ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_R2_PUBLIC_HOST: r2PublicHost ?? "",
  },
  images: {
    // Serve AVIF/WebP to browsers that accept them — the single biggest
    // payload win for property photos on mobile data.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Default public R2 bucket domains.
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      // Tenant media domain when R2_PUBLIC_BASE_URL is configured.
      ...(r2PublicHost
        ? [
            {
              protocol: "https" as const,
              hostname: r2PublicHost,
            },
          ]
        : []),
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
        ],
      },
    ];
  },
};

export default nextConfig;
