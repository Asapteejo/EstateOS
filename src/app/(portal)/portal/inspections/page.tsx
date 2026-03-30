import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerInspectionBookings } from "@/modules/inspections/service";

export default async function PortalInspectionsPage() {
  const tenant = await requirePortalSession();
  const bookings = await getBuyerInspectionBookings(tenant);

  return (
    <DashboardShell
      area="portal"
      title="Inspection Bookings"
      subtitle="Track requested, confirmed, and rescheduled site visits from the latest persisted booking state."
    >
      <div className="space-y-4">
        {bookings.length === 0 ? (
          <Card className="p-8 text-sm text-[var(--ink-600)]">
            No inspection bookings yet. Use a property page to request a site visit.
          </Card>
        ) : (
          bookings.map((booking) => (
            <Card key={booking.id} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--ink-950)]">
                    {booking.property.title}
                  </h3>
                  <div className="mt-2 text-sm text-[var(--ink-600)]">
                    {new Date(booking.scheduledFor).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-medium text-[var(--ink-700)]">
                  {booking.status.replaceAll("_", " ")}
                </div>
              </div>
              <div className="mt-4 text-sm text-[var(--ink-600)]">
                Assigned contact:{" "}
                {booking.assignedStaff
                  ? `${booking.assignedStaff.user.firstName ?? ""} ${booking.assignedStaff.user.lastName ?? ""}`.trim() ||
                    "Assigned staff"
                  : "Pending assignment"}
              </div>
            </Card>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
