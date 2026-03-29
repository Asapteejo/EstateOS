import type { Metadata } from "next";

import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformHeader } from "@/components/platform/platform-header";

export const metadata: Metadata = {
  title: "EstateOS Platform",
  description:
    "EstateOS is a real estate SaaS for listings, CRM, buyer portal operations, payments, and platform-level monetization.",
};

export default function PlatformMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PlatformHeader />
      <main>{children}</main>
      <PlatformFooter />
    </>
  );
}
