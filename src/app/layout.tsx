import type { Metadata } from "next";

import { AppProviders } from "@/components/providers/app-providers";
import { logStartupReadinessOnce } from "@/lib/ops/startup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acme Realty Platform",
  description:
    "Production-grade foundation for a premium real estate platform spanning marketing, buyer transactions, and internal operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  logStartupReadinessOnce();

  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
