import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getSuperadminDashboardData } from "@/modules/superadmin/queries";

export default async function SuperadminCompaniesPage() {
  await requireSuperAdminSession();
  const dashboard = await getSuperadminDashboardData();

  return (
    <SuperadminShell
      title="Company Oversight"
      subtitle="Cross-company plan health, payout readiness, and monetization posture for the EstateOS platform owner."
    >
      <div className="space-y-4">
        {dashboard.companies.map((company) => (
          <Card
            key={company.companyId}
            className="grid gap-4 p-6 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr_auto]"
          >
            <div>
              <div className="font-semibold text-[var(--ink-950)]">{company.companyName}</div>
              <div className="mt-1 text-sm text-[var(--ink-500)]">{company.companySlug}</div>
            </div>
            <div className="text-sm text-[var(--ink-700)]">
              <div>{company.planLabel}</div>
              <div className="mt-1 text-[var(--ink-500)]">{company.subscriptionStatus}</div>
            </div>
            <div className="text-sm text-[var(--ink-700)]">{company.transactionVolume}</div>
            <div className="text-sm text-[var(--ink-700)]">{company.payoutReadiness}</div>
            <div className="flex justify-end">
              <Link
                href={`/superadmin/companies/${company.companyId}`}
                className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]"
              >
                Inspect
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </SuperadminShell>
  );
}
