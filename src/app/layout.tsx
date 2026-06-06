import type { Metadata } from "next";
import { Inter, Libre_Baskerville } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { DevAccessSwitcher } from "@/components/shared/dev-access-switcher";
import { featureFlags } from "@/lib/env";
import { logStartupReadinessOnce } from "@/lib/ops/startup";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  logStartupReadinessOnce();

  return (
    <html lang="en" className={`${fontSans.variable} ${fontSerif.variable}`}>
      <body>
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
