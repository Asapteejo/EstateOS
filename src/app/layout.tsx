import type { Metadata } from "next";

import { AppProviders } from "@/components/providers/app-providers";
import { DevAccessSwitcher } from "@/components/shared/dev-access-switcher";
import { logStartupReadinessOnce } from "@/lib/ops/startup";
import "./globals.css";

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
    <html lang="en">
      <body>
        <AppProviders>
          {children}
          <DevAccessSwitcher />
        </AppProviders>
      </body>
    </html>
  );
}
