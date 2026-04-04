import type { Metadata } from "next";

import { TenantThemeShell } from "@/components/branding/tenant-theme-shell";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getPublishedTenantBranding, getTenantPresentation } from "@/modules/branding/service";
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
  const tenant = await requirePublicTenantContext();
  const presentation = await getTenantPresentation(tenant);
  const branding = presentation.branding;

  return (
    <TenantThemeShell branding={branding} surface="public">
      <MarketingHeader companyName={presentation.companyName} logoUrl={branding.logoUrl} />
      <main>{children}</main>
      <MarketingFooter companyName={presentation.companyName} logoUrl={branding.logoUrl} />
    </TenantThemeShell>
  );
}
