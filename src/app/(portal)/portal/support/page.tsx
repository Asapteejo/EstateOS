import { DashboardShell } from "@/components/portal/dashboard-shell";
import { SupportRequestForm } from "@/components/portal/support-request-form";
import { getAppSession } from "@/lib/auth/session";
import { requirePortalSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";

export default async function PortalSupportPage() {
  const tenant = await requirePortalSession();
  const session = await getAppSession("portal");
  const company = featureFlags.hasDatabase && tenant.companyId
    ? await prisma.company.findUnique({
        where: { id: tenant.companyId },
        select: { name: true },
      })
    : null;
  const companyName = company?.name ?? tenant.companySlug ?? "your company";

  return (
    <DashboardShell
      area="portal"
      title="Support"
      subtitle={`Send a support request to ${companyName}'s support team without leaving your buyer workspace.`}
    >
      <SupportRequestForm
        initialName={session ? `${session.firstName} ${session.lastName}`.trim() : ""}
        initialEmail={session?.email ?? ""}
        companyName={companyName}
      />
    </DashboardShell>
  );
}
