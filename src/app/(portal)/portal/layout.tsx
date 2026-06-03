import { requirePortalSession } from "@/lib/auth/guards";
import { AuthProviders } from "@/components/providers/auth-providers";
import { TenantThemeShell } from "@/components/branding/tenant-theme-shell";
import { getPublishedTenantBranding } from "@/modules/branding/service";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requirePortalSession();
  const branding = await getPublishedTenantBranding(tenant);
  return (
    <AuthProviders>
      <TenantThemeShell branding={branding} surface="app">{children}</TenantThemeShell>
    </AuthProviders>
  );
}
