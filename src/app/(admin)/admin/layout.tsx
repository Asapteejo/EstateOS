import { requireAdminSession } from "@/lib/auth/guards";
import { AuthProviders } from "@/components/providers/auth-providers";
import { TenantThemeShell } from "@/components/branding/tenant-theme-shell";
import { getPublishedTenantBranding } from "@/modules/branding/service";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireAdminSession();
  const branding = await getPublishedTenantBranding(tenant);
  return (
    <AuthProviders>
      <TenantThemeShell branding={branding} surface="app">{children}</TenantThemeShell>
    </AuthProviders>
  );
}
