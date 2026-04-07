import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TenantPublicShell } from "@/components/marketing/tenant-public-shell";
import { getPublishedTenantBranding } from "@/modules/branding/service";
import { requirePublicTenantContext } from "@/lib/tenancy/context";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await requirePublicTenantContext();
    const branding = await getPublishedTenantBranding(tenant);

    return {
      icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
    };
  } catch {
    return {};
  }
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let tenant;

  try {
    tenant = await requirePublicTenantContext();
  } catch {
    notFound();
  }

  return <TenantPublicShell tenant={tenant}>{children}</TenantPublicShell>;
}
