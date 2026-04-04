import { requireAdminSession } from "@/lib/auth/guards";
import { TenantThemeShell } from "@/components/branding/tenant-theme-shell";
import { getPublishedTenantBranding } from "@/modules/branding/service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireAdminSession();
  const branding = await getPublishedTenantBranding(tenant);
  return <TenantThemeShell branding={branding} surface="app">{children}</TenantThemeShell>;
}
