import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TenantPublicShell } from "@/components/marketing/tenant-public-shell";
import { getPublishedTenantBranding, getTenantPresentation } from "@/modules/branding/service";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { getPublishedSiteContent } from "@/modules/cms/site-content-service";
import { requirePublicTenantContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await requirePublicTenantContext();
    const [branding, presentation, storedContent] = await Promise.all([
      getPublishedTenantBranding(tenant),
      getTenantPresentation(tenant),
      getPublishedSiteContent(tenant),
    ]);
    const name = presentation.companyName;
    // Tenant-authored SEO title/description with company-derived fallbacks.
    const siteContent = resolveTenantSiteContent({
      companyName: name,
      startPurchaseHref: "/portal",
      stored: storedContent,
    });

    return {
      title: { default: siteContent.seo.title, template:`%s \u00b7 ${name}` },
      description: siteContent.seo.description,
      openGraph: {
        title: siteContent.seo.title,
        description: siteContent.seo.description,
        siteName: name,
        type: "website",
        ...(branding.heroImageUrl ? { images: [{ url: branding.heroImageUrl }] } : {}),
      },
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
