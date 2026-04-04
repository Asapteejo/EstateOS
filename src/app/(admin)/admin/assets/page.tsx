import { DashboardShell } from "@/components/portal/dashboard-shell";
import { AssetLibraryBrowser } from "@/components/uploads/asset-library-browser";
import { requireAdminSession } from "@/lib/auth/guards";
import { getTenantMediaLibrary } from "@/modules/uploads/library";

export default async function AdminAssetsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const assets = await getTenantMediaLibrary(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Media Library"
      subtitle="Browse reusable tenant assets across branding, staff, property media, brochures, and private document-backed uploads."
    >
      <AssetLibraryBrowser assets={assets} />
    </DashboardShell>
  );
}
