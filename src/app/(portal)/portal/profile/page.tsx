import Link from "next/link";
import Image from "next/image";

import { DevCreateBuyerProfileButton } from "@/components/portal/dev-create-buyer-profile-button";
import { ProfileForm } from "@/components/portal/profile-form";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { PrintButton } from "@/components/shared/print-button";
import { requireBuyerPortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { featureFlags } from "@/lib/env";
import { getTenantPresentation } from "@/modules/branding/service";
import { getBuyerKycWorkspace, getBuyerProfileRecord } from "@/modules/kyc/service";

export default async function PortalProfilePage() {
  const tenant = await requireBuyerPortalSession();
  const session = await getAppSession("portal");
  const [profile, presentation, kycWorkspace] = await Promise.all([
    getBuyerProfileRecord(tenant, { email: session?.email }),
    getTenantPresentation(tenant),
    getBuyerKycWorkspace(tenant, { email: session?.email }),
  ]);

  return (
    <DashboardShell
      area="portal"
      title="Profile"
      subtitle="Maintain buyer identity, contact, and next-of-kin information used by sales, legal, and finance."
    >
      {profile ? (
        <div className="space-y-5">
          <div className="flex justify-end print:hidden">
            <PrintButton label="Print Profile" />
          </div>
          <section className="hidden print:block">
            <PrintableBuyerProfile
              companyName={presentation.companyName}
              logoUrl={presentation.branding.logoUrl}
              profile={profile}
              kycStatus={kycWorkspace.overallStatus}
            />
          </section>
          <div className="print:hidden">
            <ProfileForm initialValue={profile} />
          </div>
        </div>
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

function PrintableBuyerProfile({
  companyName,
  logoUrl,
  profile,
  kycStatus,
}: {
  companyName: string;
  logoUrl: string | null;
  profile: NonNullable<Awaited<ReturnType<typeof getBuyerProfileRecord>>>;
  kycStatus: string;
}) {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || profile.email;
  const rows = [
    ["Full name", fullName],
    ["Email", profile.email],
    ["Phone", profile.phone],
    ["Country", profile.country],
    ["Address", [profile.addressLine1, profile.addressLine2, profile.city, profile.state].filter(Boolean).join(", ")],
    ["KYC status", kycStatus.toLowerCase().replaceAll("_", " ")],
    ["Nationality", profile.nationality],
    ["Occupation", profile.occupation],
    ["Next of kin", [profile.nextOfKinName, profile.nextOfKinPhone].filter(Boolean).join(" - ")],
    ["Date generated", new Date().toLocaleString()],
  ];

  return (
    <div className="mx-auto max-w-3xl bg-white text-black">
      <div className="flex items-center justify-between border-b border-black/20 pb-5">
        <div>
          <div className="text-2xl font-semibold">{companyName}</div>
          <div className="mt-1 text-sm">Buyer profile</div>
        </div>
        {logoUrl ? (
          <Image src={logoUrl} alt={companyName} width={56} height={56} unoptimized className="h-14 w-14 object-contain" />
        ) : null}
      </div>
      <div className="mt-6 flex items-center gap-4">
        {profile.profileImageUrl ? (
          <Image src={profile.profileImageUrl} alt={fullName} width={80} height={80} unoptimized className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-black/20 text-xl font-semibold">
            {fullName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-xl font-semibold">{fullName}</div>
          <div className="text-sm">{profile.email}</div>
        </div>
      </div>
      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-black/10 pb-2">
            <dt className="text-xs uppercase tracking-wide text-black/60">{label}</dt>
            <dd className="mt-1 text-sm font-medium">{value || "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
