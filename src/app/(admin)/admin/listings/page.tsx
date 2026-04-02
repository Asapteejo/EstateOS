import { PropertyManagement } from "@/components/admin/property-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import {
  getAdminPropertyManagementList,
  getAvailableBrochureDocuments,
} from "@/modules/properties/admin-queries";

export default async function AdminListingsPage() {
  const tenant = await requireAdminSession();
  const [properties, brochures] = await Promise.all([
    getAdminPropertyManagementList(tenant),
    getAvailableBrochureDocuments(tenant),
  ]);

  return (
    <DashboardShell
      area="admin"
      title="Listings Management"
      subtitle="Create, edit, publish, and keep live inventory verified so outdated listings never leak publicly."
    >
      <PropertyManagement properties={properties} brochures={brochures} />
    </DashboardShell>
  );
}
