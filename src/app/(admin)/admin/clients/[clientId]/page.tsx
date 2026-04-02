import { notFound } from "next/navigation";

import { ClientActivityView } from "@/components/admin/client-activity-view";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminClientProfile } from "@/modules/clients/queries";

export default async function AdminClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const { clientId } = await params;
  const client = await getAdminClientProfile(tenant, clientId);

  if (!client) {
    notFound();
  }

  return (
    <DashboardShell
      area="admin"
      title={client.name}
      subtitle="Intent signals, follow-up state, and full buyer activity for this tenant client."
    >
      <ClientActivityView client={client} />
    </DashboardShell>
  );
}
