import Link from "next/link";

import { DevCreateBuyerProfileButton } from "@/components/portal/dev-create-buyer-profile-button";
import { ProfileForm } from "@/components/portal/profile-form";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requireBuyerPortalSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { getBuyerProfileRecord } from "@/modules/kyc/service";

export default async function PortalProfilePage() {
  const tenant = await requireBuyerPortalSession();
  const profile = await getBuyerProfileRecord(tenant);

  return (
    <DashboardShell
      area="portal"
      title="Profile"
      subtitle="Maintain buyer identity, contact, and next-of-kin information used by sales, legal, and finance."
    >
      {profile ? (
        <ProfileForm initialValue={profile} />
      ) : (
        <Card className="rounded-[28px] p-8">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
              Buyer profile
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
              Your buyer profile is not set up yet.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-600)]">
              Add your contact and next-of-kin details so sales, legal, and finance can keep your transaction moving.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/portal/kyc"
                className="inline-flex items-center justify-center rounded-full bg-[var(--ink-950)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--ink-800)]"
              >
                Continue to KYC
              </Link>
              {featureFlags.isProduction ? null : <DevCreateBuyerProfileButton />}
            </div>
            {featureFlags.isProduction ? null : (
              <p className="mt-4 text-xs leading-6 text-[var(--ink-500)]">
                Dev tip: use <code>/api/dev/session?role=buyer&amp;redirectTo=/portal/profile</code> to switch into the buyer portal intentionally.
              </p>
            )}
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
