import { SupportRequestManagement } from "@/components/admin/support-request-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { listSupportRequestsForCompany } from "@/modules/support/service";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const requestId = resolvedSearchParams.requestId ?? null;
  const items = await listSupportRequestsForCompany(tenant.companyId!, requestId);

  return (
    <DashboardShell
      area="admin"
      title="Support"
      subtitle="Review portal support intake, retry failed Linear syncs, and jump back into the operator workflow from linked issues."
    >
      <SupportRequestManagement items={items} highlightedRequestId={requestId} />
    </DashboardShell>
  );
}
