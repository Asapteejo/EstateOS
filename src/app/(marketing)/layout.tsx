import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TenantPublicShell } from "@/components/marketing/tenant-public-shell";
import { getPublishedTenantBranding, getTenantPresentation } from "@/modules/branding/service";
import { requirePublicTenantContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await requirePublicTenantContext();
    const [branding, presentation] = await Promise.all([
      getPublishedTenantBranding(tenant),
      getTenantPresentation(tenant),
    ]);
    const name = presentation.companyName;

    return {
      title: { default: name, template: `%s \u00b7 ${name}` },
      description: `${name} — property listings, viewings, and secure transactions.`,
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
