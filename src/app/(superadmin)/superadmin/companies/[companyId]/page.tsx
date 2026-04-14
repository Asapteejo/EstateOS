import { notFound } from "next/navigation";

import { SuperadminActivityFeed } from "@/components/superadmin/superadmin-activity-feed";
import { CompanyLifecycleControls } from "@/components/superadmin/company-lifecycle-controls";
import { SuperadminCompanyStatusBadge } from "@/components/superadmin/superadmin-company-status-badge";
import { SuperadminHealthBadge } from "@/components/superadmin/superadmin-health-badge";
import { SuperadminMetricCard } from "@/components/superadmin/superadmin-metric-card";
import { SuperadminRangeTabs } from "@/components/superadmin/superadmin-range-tabs";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getSuperadminCompanyOverview, parseSuperadminRange } from "@/modules/superadmin/queries";

export default async function SuperadminCompanyOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const { companyId } = await params;
  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const range = parseSuperadminRange(resolvedSearchParams.range);

  let company: Awaited<ReturnType<typeof getSuperadminCompanyOverview>>;
  try {
    company = await getSuperadminCompanyOverview(companyId, range);
  } catch {
    notFound();
  }

  return (
    <SuperadminShell
      title={company.company.companyName}
      subtitle="Deep platform-owner analytics for tenant revenue, collections posture, billing setup, and operating health."
      actions={<SuperadminRangeTabs pathname={`/superadmin/companies/${companyId}`} current={range} />}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <SuperadminMetricCard label="Deals" value={String(company.businessMetrics.totalDeals)} detail="Total revenue records in this workspace" />
        <SuperadminMetricCard label="Payment requests" value={String(company.businessMetrics.totalPaymentRequests)} detail="Requests sent through the workflow" />
        <SuperadminMetricCard label="Completed payments" value={String(company.businessMetrics.totalPaymentsCompleted)} detail="Successful reconciled payments" tone="revenue" />
        <SuperadminMetricCard label="Overdue" value={formatCurrency(company.businessMetrics.totalOverdue)} detail={company.businessMetrics.collectionsPerformance} tone="risk" />
        <SuperadminMetricCard label="EstateOS revenue" value={formatCurrency(company.platformMetrics.estateRevenue)} detail="What this tenant has generated for the platform" tone="revenue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Platform controls</h2>
            <SuperadminCompanyStatusBadge status={company.company.companyStatus} />
            <SuperadminHealthBadge health={company.company.health} />
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-600)]">
            Governance actions are intentionally limited to lifecycle control. Suspending a company blocks operator and buyer access without deleting tenant data.
          </p>
          <div className="mt-5">
            <CompanyLifecycleControls
              companyId={companyId}
              companyName={company.company.companyName}
              status={company.company.companyStatus}
              suspensionReason={company.company.suspensionReason}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Company status</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-[var(--ink-500)]">Current status</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.company.companyStatus}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Last active</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.company.lastActiveLabel}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Delete company</div>
              <div className="mt-1 text-[var(--ink-700)]">
                Not available. EstateOS does not yet have a safe archive/delete lifecycle for tenant-linked revenue, payments, and audit data.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Business and platform profile</h2>
            <SuperadminHealthBadge health={company.company.health} />
            <SuperadminCompanyStatusBadge status={company.company.companyStatus} />
          </div>
          <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <div className="text-[var(--ink-500)]">Current plan</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.platformMetrics.subscriptionPlan}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Subscription status</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.platformMetrics.subscriptionStatus}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Commission rule</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.platformMetrics.commissionRule}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Payout readiness</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.platformMetrics.payoutReadiness}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Transaction provider</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.platformMetrics.billingProvider}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Last active</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.company.lastActiveLabel}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Inquiry → reservation</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.businessMetrics.inquiryToReservation}</div>
            </div>
            <div>
              <div className="text-[var(--ink-500)]">Reservation → payment</div>
              <div className="mt-1 font-semibold text-[var(--ink-950)]">{company.businessMetrics.reservationToPayment}</div>
            </div>
          </div>
          <div className="mt-5 rounded-[24px] bg-[var(--sand-100)] p-4 text-sm text-[var(--ink-600)]">
            Updated {company.generatedAtLabel}. This drill-down is read-only for safety and keeps platform-owner money distinct from tenant collections volume.
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Recent deals and collections activity</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Spot overdue follow-ups, stalled deals, and the latest payment movement inside the tenant.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {company.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="grid gap-3 px-6 py-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr] lg:items-center">
                <div>
                  <div className="font-semibold text-[var(--ink-950)]">{transaction.buyerName}</div>
                  <div className="mt-1 text-sm text-[var(--ink-500)]">{transaction.propertyTitle}</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div>{transaction.totalValue}</div>
                  <div className="mt-1 text-[var(--ink-500)]">Outstanding {transaction.outstanding}</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div>{transaction.paymentStatus}</div>
                  <div className="mt-1 text-[var(--ink-500)]">{transaction.nextAction}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5"><h2 className="text-lg font-semibold text-[var(--ink-950)]">Recent payment requests</h2></div>
          <div className="divide-y divide-[var(--line)]">
            {company.recentPaymentRequests.map((item) => (
              <div key={item.id} className="px-6 py-4 text-sm">
                <div className="font-semibold text-[var(--ink-950)]">{item.title}</div>
                <div className="mt-1 text-[var(--ink-600)]">{item.amount}</div>
                <div className="mt-1 text-[var(--ink-500)]">{item.status}  -  Due {item.dueAt}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5"><h2 className="text-lg font-semibold text-[var(--ink-950)]">Provider and billing controls</h2></div>
          <div className="divide-y divide-[var(--line)]">
            {company.providerAccounts.map((item) => (
              <div key={item.id} className="px-6 py-4 text-sm">
                <div className="font-semibold text-[var(--ink-950)]">{item.name}</div>
                <div className="mt-1 text-[var(--ink-600)]">{item.provider}  -  {item.status}</div>
                <div className="mt-1 text-[var(--ink-500)]">{item.splitReady}  -  Updated {item.updatedAt}</div>
              </div>
            ))}
            {company.subscriptions.map((item) => (
              <div key={item.id} className="px-6 py-4 text-sm">
                <div className="font-semibold text-[var(--ink-950)]">{item.label}</div>
                <div className="mt-1 text-[var(--ink-600)]">{item.status}</div>
                <div className="mt-1 text-[var(--ink-500)]">{item.startsAt} → {item.endsAt}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5"><h2 className="text-lg font-semibold text-[var(--ink-950)]">Billing and payment timeline</h2></div>
          <div className="divide-y divide-[var(--line)]">
            {company.recentBilling.map((item) => (
              <div key={item.id} className="px-6 py-4 text-sm">
                <div className="font-semibold text-[var(--ink-950)]">{item.type}</div>
                <div className="mt-1 text-[var(--ink-600)]">{item.summary}</div>
                <div className="mt-1 text-[var(--ink-500)]">{item.amount ?? "No amount"}  -  {item.createdAt}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <SuperadminActivityFeed
        title="Recent company activity"
        subtitle="Fast read on onboarding, collections, and revenue motion inside this tenant."
        items={company.recentActivity.map((item) => ({
          id: item.id,
          timestamp: item.timestamp,
          type: "company_onboarded",
          companyId,
          companyName: company.company.companyName,
          title: item.title,
          summary: item.summary,
          amount: null,
          amountLabel: null,
          accent: "neutral",
        }))}
      />
    </SuperadminShell>
  );
}
