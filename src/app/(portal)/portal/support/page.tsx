import { DashboardShell } from "@/components/portal/dashboard-shell";
import { SupportRequestForm } from "@/components/portal/support-request-form";
import { getAppSession } from "@/lib/auth/session";

export default async function PortalSupportPage() {
  const session = await getAppSession("portal");

  return (
    <DashboardShell
      area="portal"
      title="Support"
      subtitle="Send a support request without leaving your buyer workspace. EstateOS stores the request internally and can open a Linear issue for the operator team when configured."
    >
      <SupportRequestForm
        initialName={session ? `${session.firstName} ${session.lastName}`.trim() : ""}
        initialEmail={session?.email ?? ""}
      />
    </DashboardShell>
  );
}
