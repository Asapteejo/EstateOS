import type { Metadata } from "next";

import { TenantHomepage } from "@/components/marketing/tenant-homepage";
import { TenantPublicShell } from "@/components/marketing/tenant-public-shell";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformHeader } from "@/components/platform/platform-header";
import { PlatformHome } from "@/components/platform/platform-home";
import { logInfo } from "@/lib/ops/logger";
import { resolveTenantContext } from "@/lib/tenancy/context";
import { getPublishedTenantBranding } from "@/modules/branding/service";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await resolveTenantContext("marketing");

  if (!tenant.companyId) {
    return {
      title: "EstateOS",
      description: "Sales and payments operating system for real estate developers in Africa.",
    };
  }

  const branding = await getPublishedTenantBranding(tenant);
  return {
    icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
  };
}

export default async function RootPage() {
  const tenant = await resolveTenantContext("marketing");

  if (!tenant.companyId) {
    logInfo("Rendering platform marketing at root.", {
      host: tenant.host,
      resolutionSource: tenant.resolutionSource,
    });

    return (
      <>
        <PlatformHeader />
        <main>
          <PlatformHome />
        </main>
        <PlatformFooter />
      </>
    );
  }

  logInfo("Resolved tenant homepage at root.", {
    host: tenant.host,
    companyId: tenant.companyId,
    companySlug: tenant.companySlug,
    resolutionSource: tenant.resolutionSource,
  });

  return (
    <TenantPublicShell tenant={tenant}>
      <TenantHomepage tenant={tenant} />
    </TenantPublicShell>
  );
}
