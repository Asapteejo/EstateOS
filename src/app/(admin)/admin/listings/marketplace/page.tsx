import Link from "next/link";

import {
  AdminEmptyState,
  AdminPanel,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getAdminMarketplaceRows } from "@/modules/properties/marketplace";
import { toggleMarketplaceListingAction } from "./actions";

export default async function AdminMarketplacePage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const properties = await getAdminMarketplaceRows(tenant.companyId!);

  const listedCount = properties.filter((p) => p.isMarketplaceListed).length;

  return (
    <DashboardShell
      area="admin"
      title="Marketplace listings"
      subtitle="Control which of your verified properties appear in the cross-company EstateOS marketplace. Only publicly visible, verified or stale properties are eligible — toggle opt-in per property."
    >
      <AdminToolbar>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--ink-600)]">
            {listedCount} of {properties.length} propert
            {properties.length === 1 ? "y" : "ies"} opted into the marketplace.
          </p>
          <Link href="/platform/properties" target="_blank">
            <Button variant="outline" size="sm">
              View marketplace
            </Button>
          </Link>
        </div>
      </AdminToolbar>

      <AdminPanel
        title="Property opt-in"
        description="Enable marketplace listing per property. Only eligible properties (publicly visible with verified or stale verification) will actually appear — others are accepted but held until they pass the gate."
        className="px-0 py-0"
      >
        {properties.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  {[
                    "Property",
                    "Type",
                    "Price from",
                    "Status",
                    "Verification",
                    "Visible",
                    "Marketplace",
                  ].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const eligible =
                    property.isPubliclyVisible &&
                    (property.verificationStatus === "VERIFIED" ||
                      property.verificationStatus === "STALE");

                  return (
                    <tr key={property.id}>
                      <td>
                        <div className="min-w-[200px]">
                          <div className="font-semibold text-[var(--ink-950)]">
                            {property.title}
                          </div>
                          <div className="text-xs text-[var(--ink-500)]">
                            {property.locationSummary ?? "—"}
                          </div>
                        </div>
                      </td>
                      <td className="capitalize">
                        {property.propertyType.replaceAll("_", " ").toLowerCase()}
                      </td>
                      <td className="font-medium text-[var(--ink-950)]">
                        {formatCurrency(property.priceFrom)}
                      </td>
                      <td className="capitalize">
                        {property.status.toLowerCase()}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            property.verificationStatus === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800"
                              : property.verificationStatus === "STALE"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[var(--sand-100)] text-[var(--ink-500)]"
                          }`}
                        >
                          {property.verificationStatus.toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`text-xs font-medium ${
                            property.isPubliclyVisible
                              ? "text-emerald-700"
                              : "text-[var(--ink-400)]"
                          }`}
                        >
                          {property.isPubliclyVisible ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <form action={toggleMarketplaceListingAction}>
                            <input
                              type="hidden"
                              name="propertyId"
                              value={property.id}
                            />
                            <input
                              type="hidden"
                              name="listed"
                              value={property.isMarketplaceListed ? "false" : "true"}
                            />
                            <button
                              type="submit"
                              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                                property.isMarketplaceListed
                                  ? "bg-[var(--ink-950)] text-white hover:bg-[var(--ink-800)]"
                                  : "border border-[var(--line)] bg-white text-[var(--ink-700)] hover:border-[var(--ink-300)]"
                              }`}
                            >
                              {property.isMarketplaceListed ? "Listed" : "List"}
                            </button>
                          </form>
                          {!eligible && property.isMarketplaceListed && (
                            <span className="text-[10px] text-[var(--ink-400)]">
                              Not yet eligible
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-5">
            <AdminEmptyState
              title="No properties to list"
              description="Create and publish properties in Listings Management first, then return here to opt them into the marketplace."
            />
          </div>
        )}
      </AdminPanel>

      <AdminToolbar>
        <div className="space-y-1 text-sm text-[var(--ink-500)]">
          <p>
            Properties are eligible for the marketplace when they are publicly visible
            and have a verification status of{" "}
            <strong className="text-[var(--ink-700)]">Verified</strong> or{" "}
            <strong className="text-[var(--ink-700)]">Stale</strong>. Toggling
            opt-in for ineligible properties will take effect once they pass the
            verification gate.
          </p>
          <p>
            Manage property visibility and verification in{" "}
            <Link href="/admin/listings" className="underline underline-offset-2">
              Listings Management
            </Link>
            .
          </p>
        </div>
      </AdminToolbar>
    </DashboardShell>
  );
}
