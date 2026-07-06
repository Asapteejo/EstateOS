import type { Metadata, Viewport } from "next";
import { Inter, Libre_Baskerville } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { DevAccessSwitcher } from "@/components/shared/dev-access-switcher";
import { RouteProgress } from "@/components/shared/route-progress";
import { featureFlags } from "@/lib/env";
import { logStartupReadinessOnce } from "@/lib/ops/startup";
import { THEME_INIT_SCRIPT } from "@/lib/security/csp";
import "./globals.css";

// Web-loaded, self-hosted fonts (next/font downloads + serves them from our own
// origin at build time — no external CDN, so CSP `font-src 'self'` already
// covers them). These replace the previous Windows/Office-only font assumptions
// (Aptos / Baskerville Old Face) that failed to load on Mac, iOS, Android, and
// Linux. `display: "swap"` + next/font's automatic size-adjusted fallback keep
// cumulative layout shift minimal.
//
// Identity mapping: Inter ≈ Aptos (neutral humanist sans for body/UI),
// Libre Baskerville ≈ Baskerville Old Face (classic serif for headings).
const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-web",
});

const fontSerif = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif-web",
});

export const metadata: Metadata = {
  title: "EstateOS",
  description:
    "EstateOS is a real estate SaaS for platform owners and tenant companies spanning listings, CRM, payments, and buyer transaction visibility.",
  // PWA / install metadata. The manifest itself is served from
  // src/app/manifest.ts; the apple-touch icon lives in public/.
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "EstateOS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Browser chrome color follows the active theme (brand green on light,
  // the dashboard's dark background on dark).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e5b49" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1219" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  logStartupReadinessOnce();

  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${fontSans.variable} ${fontSerif.variable}`}>
      <body>
        {/* Pre-hydration theme bootstrap. The text lives in @/lib/security/csp
            because the enforced CSP authorizes it by SHA-256 hash — keeping the
            script and its hash in one module (verified by csp.test.ts) means
            editing one without the other fails tests instead of breaking prod. */}
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
        <RouteProgress />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-md focus:bg-[var(--brand-700)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to main content
        </a>
        {featureFlags.devAccessMode ? (
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2147483647,
              background: "#b91c1c",
              color: "white",
              padding: "10px 16px",
              textAlign: "center",
              fontFamily: "Arial, sans-serif",
              fontSize: "14px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            DEV ACCESS MODE ACTIVE | AUTHENTICATION BYPASSED
          </div>
        ) : null}
        <AppProviders>
          {children}
          <DevAccessSwitcher />
        </AppProviders>
      </body>
    </html>
  );
}
