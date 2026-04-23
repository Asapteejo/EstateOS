import { IncidentManagement } from "@/components/admin/incident-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { listObservedIncidentsForCompany } from "@/modules/incidents/service";

export default async function AdminIncidentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const fingerprint = resolvedSearchParams.fingerprint ?? null;
  const items = await listObservedIncidentsForCompany(tenant.companyId!, fingerprint);

  return (
    <DashboardShell
      area="admin"
      title="Incidents"
      subtitle="Review grouped operational failures, see which ones were escalated, and jump into the linked Linear issue without reopening duplicates."
    >
      <IncidentManagement items={items} highlightedFingerprint={fingerprint} />
    </DashboardShell>
  );
}
