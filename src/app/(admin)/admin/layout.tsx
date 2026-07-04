import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/auth/guards";
import { AuthProviders } from "@/components/providers/auth-providers";
import { TenantThemeShell } from "@/components/branding/tenant-theme-shell";
import { getPublishedTenantBranding, getTenantPresentation } from "@/modules/branding/service";
import { featureFlags } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
    const presentation = await getTenantPresentation(tenant);
    const name = presentation.companyName;
    return { title: { default: name, template: `%s \u00b7 ${name}` } };
  } catch {
    return {};
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireAdminSession();
  const branding = await getPublishedTenantBranding(tenant);
  return (
    <AuthProviders disableClerkForDev={featureFlags.allowDevBypass}>
      <TenantThemeShell branding={branding} surface="app">{children}</TenantThemeShell>
    </AuthProviders>
  );
}
