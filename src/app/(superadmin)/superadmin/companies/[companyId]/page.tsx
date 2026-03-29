import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { DataTableCard } from "@/components/shared/data-table-card";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getSuperadminCompanyOverview } from "@/modules/superadmin/queries";

export default async function SuperadminCompanyOverviewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireSuperAdminSession();

  const { companyId } = await params;
  let company: Awaited<ReturnType<typeof getSuperadminCompanyOverview>>;

  try {
    company = await getSuperadminCompanyOverview(companyId);
  } catch {
    notFound();
  }

  return (
    <SuperadminShell
      title={company.companyName}
      subtitle="Safe superadmin drill-down into tenant billing state, payout readiness, payment flow, and monetization outcomes."
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Current plan</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{company.currentPlan}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Subscription status</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{company.subscriptionStatus}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Transaction volume</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{company.transactionVolume}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Commission earned</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{company.commissionEarned}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTableCard
          title="Recent billing events"
          columns={["Event", "Summary", "Time"]}
          rows={company.billingEvents}
        />
        <DataTableCard
          title="Recent payments"
          columns={["Reference", "Amount", "Status", "Time"]}
          rows={company.payments}
        />
      </div>
    </SuperadminShell>
  );
}
