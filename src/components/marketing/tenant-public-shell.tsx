import { TenantThemeShell } from "@/components/branding/tenant-theme-shell";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { buildAuthRedirect, buildServerDomainConfig } from "@/lib/domains";
import { env } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { getPublicTenantPresentation } from "@/modules/branding/service";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { getPublishedSiteContent } from "@/modules/cms/site-content-service";

export async function TenantPublicShell({
  tenant,
  children,
}: {
  tenant: TenantContext;
  children: React.ReactNode;
}) {
  const presentation = await getPublicTenantPresentation(tenant);
  const branding = presentation.branding;
  const runtimeConfig = buildServerDomainConfig(env);
  const buyerPortalHref = buildAuthRedirect(runtimeConfig, {
    returnTo: "/portal",
    tenantSlug: tenant.companySlug,
    tenantHost: tenant.host,
    entry: "buyer",
  });
  const adminPortalHref = buildAuthRedirect(runtimeConfig, {
    returnTo: "/admin",
    tenantSlug: tenant.companySlug,
    tenantHost: tenant.host,
    entry: "admin",
  });
  const storedContent = await getPublishedSiteContent(tenant);
  const siteContent = resolveTenantSiteContent({
    companyName: presentation.companyName,
    startPurchaseHref: buyerPortalHref,
    stored: storedContent,
  });

  return (
    <TenantThemeShell branding={branding} surface="public">
      <MarketingHeader
        companyName={presentation.companyName}
        logoUrl={branding.logoUrl}
        buyerPortalHref={buyerPortalHref}
      />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <MarketingFooter
        companyName={presentation.companyName}
        logoUrl={branding.logoUrl}
        buyerPortalHref={buyerPortalHref}
        adminPortalHref={adminPortalHref}
        tagline={siteContent.footer.tagline}
      />
    </TenantThemeShell>
  );
}
