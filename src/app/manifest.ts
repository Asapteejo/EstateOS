import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes the buyer portal (and operator workspace) installable
 * on Android/iOS/desktop. Served at /manifest.webmanifest by Next; the CSP
 * already allows `manifest-src 'self'`.
 *
 * start_url points at /portal because buyers are the primary install
 * audience; unauthenticated opens go through the normal sign-in redirect and
 * land back in the portal. Colors mirror the design tokens (brand-700 /
 * background sand).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EstateOS",
    short_name: "EstateOS",
    description:
      "Property buying, payments, inspections, and documents — your real estate workspace.",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    background_color: "#f8f6f0",
    theme_color: "#0e5b49",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
