import { DashboardShell } from "@/components/portal/dashboard-shell";
import { PropertyCard } from "@/components/marketing/property-card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerSavedProperties } from "@/modules/portal/queries";

export default async function PortalSavedPage() {
  const tenant = await requirePortalSession();
  const properties = await getBuyerSavedProperties(tenant);

  return (
    <DashboardShell area="portal" title="Saved Properties" subtitle="Shortlist and compare properties before inspection or reservation.">
      <div className="grid gap-6 lg:grid-cols-2">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </DashboardShell>
  );
}
