import { ProfileForm } from "@/components/portal/profile-form";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerProfileRecord } from "@/modules/kyc/service";

export default async function PortalProfilePage() {
  const tenant = await requirePortalSession();
  const profile = await getBuyerProfileRecord(tenant);

  return (
    <DashboardShell
      area="portal"
      title="Profile"
      subtitle="Maintain buyer identity, contact, and next-of-kin information used by sales, legal, and finance."
    >
      <ProfileForm initialValue={profile} />
    </DashboardShell>
  );
}
