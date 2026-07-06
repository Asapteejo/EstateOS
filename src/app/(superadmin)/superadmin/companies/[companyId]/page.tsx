import Link from "next/link";
import { notFound } from "next/navigation";

import { SuperadminActivityFeed } from "@/components/superadmin/superadmin-activity-feed";
import { CompanyLifecycleControls } from "@/components/superadmin/company-lifecycle-controls";
import { SuperadminCompanyStatusBadge } from "@/components/superadmin/superadmin-company-status-badge";
import { SuperadminHealthBadge } from "@/components/superadmin/superadmin-health-badge";
import { SuperadminRangeTabs } from "@/components/superadmin/superadmin-range-tabs";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { TenantReadinessChecklist } from "@/components/shared/tenant-readiness-checklist";
import { StatCard } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/utils";
import { getTenantReadinessForCompany } from "@/modules/readiness/service";
import { getSafePlatformCommissionControl } from "@/modules/superadmin/commission";
import { getSuperadminCompanyOverview, parseSuperadminRange, readSuperadminSearchParam } from "@/modules/superadmin/queries";
import {
  inviteCompanyAdminFromSuperadminAction,
  overrideSuperadminSubscriptionAction,
  updatePlatformCommissionAction,
} from "@/app/(superadmin)/superadmin/companies/actions";
import { Select } from "@/components/ui/select";

function statusText(complete: boolean) {
  return complete ? "Complete" : "Missing";
}

function VisibilityPanels({
  visibility,
}: {
  visibility: NonNullable<Awaited<ReturnType<typeof getTenantReadinessForCompany>>["visibility"]>;
}) {
  const panels = [
    {
      title: "Branding",
      action: "/admin/settings/branding",
      items: [
        ["Logo", statusText(visibility.branding.logoConfigured)],
        ["Favicon", statusText(visibility.branding.faviconConfigured)],
        ["Hero", statusText(visibility.branding.heroConfigured)],
        ["Published branding", statusText(visibility.branding.published)],
      ],
    },
    {
      title: "Payments",
      action: "/admin/settings",
      items: [
        ["Provider account", statusText(visibility.payments.providerAccounts.length > 0)],
        ["Payout readiness", statusText(visibility.payments.payoutReady)],
        ["Paystack platform", statusText(visibility.payments.paystackPlatformReady)],
      ],
    },
    {
      title: "Contracts",
      action: "/admin/settings/contracts",
      items: [
        ["Contract settings", statusText(visibility.contracts.settingsConfigured)],
        ["Company stamp", statusText(visibility.contracts.stampConfigured)],
        ["Authorized signature", statusText(visibility.contracts.signatureConfigured)],
      ],
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      {panels.map((panel) => (
        <Card key={panel.title} className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-700)]">
                Visibility
              </div>
              <h2 className="mt-3 text-lg font-semibold text-[var(--ink-950)]">{panel.title}</h2>
            </div>
            <Link href={panel.action} className="text-xs font-semibold text-[var(--brand-700)]">
              Tenant flow
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {panel.items.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-[var(--ink-600)]">{label}</span>
                <span className={value === "Complete" ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default async function SuperadminCompanyOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const { companyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const range = parseSuperadminRange(readSuperadminSearchParam(resolvedSearchParams.range));
  const error = readSuperadminSearchParam(resolvedSearchParams.error);
  const created = readSuperadminSearchParam(resolvedSearchParams.created) === "1";
  const subscriptionUpdated = readSuperadminSearchParam(resolvedSearchParams.subscription) === "updated";
  const mockCreated = readSuperadminSearchParam(resolvedSearchParams.mock) === "created";
  const commissionUpdated = readSuperadminSearchParam(resolvedSearchParams.commission) === "updated";
  const invitationSent = readSuperadminSearchParam(resolvedSearchParams.invitation) === "sent";

  let company: Awaited<ReturnType<typeof getSuperadminCompanyOverview>>;
  try {
    company = await getSuperadminCompanyOverview(companyId, range);
  } catch {
    notFound();
  }
  const [platformCommission, readiness, pendingInvitations] = await Promise.all([
    getSafePlatformCommissionControl(companyId),
    getTenantReadinessForCompany(companyId),
    prisma.teamMemberInvitation.findMany({
      where: {
        companyId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        expiresAt: true,
      },
    }),
  ]);

  return (
    <SuperadminShell
      title={company.company.companyName}
      subtitle="Deep platform-owner analytics for tenant revenue, collections posture, billing setup, and operating health."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SuperadminRangeTabs pathname={`/superadmin/companies/${companyId}`} current={range} />
          <Link
            href={`/superadmin/companies/${companyId}/qa`}
            className="rounded-full bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]"
          >
            Run QA checklist
          </Link>
          <Link
            href={`/superadmin/companies/${companyId}/domains`}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-900)] transition hover:bg-[var(--sand-100)]"
          >
            Manage domain
          </Link>
        </div>
      }
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </Card>
      ) : null}
      {created || subscriptionUpdated || mockCreated || commissionUpdated || invitationSent ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {invitationSent
            ? "Invitation sent."
            : commissionUpdated
            ? "Platform commission settings saved."
            : mockCreated
            ? "Mock company created with safe sample data."
            : subscriptionUpdated
              ? "Subscription override saved."
              : "Company created successfully."}
        </Card>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Deals" value={String(company.businessMetrics.totalDeals)} hint="Total revenue records in this workspace" />
        <StatCard label="Payment requests" value={String(company.businessMetrics.totalPaymentRequests)} hint="Requests sent through the workflow" />
        <StatCard label="Completed payments" value={String(company.businessMetrics.totalPaymentsCompleted)} hint="Successful reconciled payments" tone="success" />
        <StatCard label="Overdue" value={formatCurrency(company.businessMetrics.totalOverdue)} hint={company.businessMetrics.collectionsPerformance} tone="danger" />
        <StatCard label="EstateOS revenue" value={formatCurrency(company.platformMetrics.estateRevenue)} hint="What this tenant has generated for the platform" tone="success" />
      </div>

      <TenantReadinessChecklist
        title="Tenant readiness"
        description="Go-live checklist for profile, branding, payments, contracts, storage, domain, and public reachability."
        items={readiness.checklist}
      />

      {readiness.visibility ? <VisibilityPanels visibility={readiness.visibility} /> : null}

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

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Invite company admin</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-600)]">
              Superadmin-created invitations are limited to ADMIN or STAFF and must be claimed by
              the invited email address.
            </p>
          </div>
          <div className="rounded-full bg-[var(--sand-100)] px-4 py-2 text-sm text-[var(--ink-700)]">
            Expires after 7 days
          </div>
        </div>
        <form action={inviteCompanyAdminFromSuperadminAction} className="mt-5 grid gap-4 md:grid-cols-4">
          <input type="hidden" name="companyId" value={companyId} />
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Full name</span>
            <input name="fullName" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Ada Lovelace" />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-[var(--ink-700)]">Email</span>
            <input name="email" type="email" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="admin@company.com" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Role</span>
            <Select name="role" defaultValue="ADMIN" className="w-full">
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </Select>
          </label>
          <div className="flex items-end justify-end md:col-span-4">
            <button type="submit" className="rounded-full bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]">
              Send invitation
            </button>
          </div>
        </form>
        <div className="mt-5 rounded-2xl border border-[var(--line)]">
          <div className="border-b border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--ink-700)]">
            Pending invitations
          </div>
          {pendingInvitations.length ? (
            <div className="divide-y divide-[var(--line)]">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_0.5fr_0.8fr]">
                  <div className="font-medium text-[var(--ink-950)]">{invitation.fullName}</div>
                  <div className="text-[var(--ink-700)]">{invitation.email}</div>
                  <div className="text-[var(--ink-700)]">{invitation.role}</div>
                  <div className="text-[var(--ink-500)]">
                    Expires {invitation.expiresAt.toLocaleDateString("en-GB")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-[var(--ink-500)]">No pending invitations.</div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Subscription override</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-600)]">
              Superadmin-only plan and access changes. Manual overrides use internal billing and do not require live Paystack keys.
            </p>
          </div>
          <div className="rounded-full bg-[var(--sand-100)] px-4 py-2 text-sm text-[var(--ink-700)]">
            Current: {company.platformMetrics.subscriptionPlan}
          </div>
        </div>
        <form action={overrideSuperadminSubscriptionAction} className="mt-5 grid gap-4 md:grid-cols-5">
          <input type="hidden" name="companyId" value={companyId} />
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Plan</span>
            <Select name="plan" defaultValue="PRO" className="w-full">
              <option value="FREE">Free</option>
              <option value="PRO">Pro</option>
              <option value="PREMIUM">Premium</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Billing mode</span>
            <Select name="billingMode" defaultValue="MANUAL_OVERRIDE" className="w-full">
              <option value="MANUAL_OVERRIDE">Manual override</option>
              <option value="TRIAL">Trial</option>
              <option value="PAID">Paid</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Access</span>
            <Select name="accessStatus" defaultValue={company.company.companyStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"} className="w-full">
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Expiry date</span>
            <input name="subscriptionEndsAt" type="date" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-[var(--ink-700)]">
            <input name="lifetimeInternalTest" type="checkbox" className="h-4 w-4 rounded border-[var(--line)]" />
            Lifetime/internal test
          </label>
          <label className="space-y-2 text-sm md:col-span-4">
            <span className="font-medium text-[var(--ink-700)]">Internal note</span>
            <textarea name="internalNote" rows={3} className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Reason for plan/access override." />
          </label>
          <div className="flex items-end justify-end">
            <button type="submit" className="rounded-full bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]">
              Save override
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Platform Commission</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-600)]">
              Superadmin-only revenue rules used by Paystack split settlement. Tenant admins cannot
              edit these values.
            </p>
          </div>
          <div className="rounded-full bg-[var(--sand-100)] px-4 py-2 text-sm text-[var(--ink-700)]">
            Current: {company.platformMetrics.commissionRule}
          </div>
        </div>
        <form action={updatePlatformCommissionAction} className="mt-5 grid gap-4 md:grid-cols-4">
          <input type="hidden" name="companyId" value={companyId} />
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Commission percentage</span>
            <input
              name="commissionPercentage"
              type="number"
              min={0}
              max={100}
              step={0.1}
              defaultValue={platformCommission.commissionPercentage}
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Fixed fee</span>
            <input
              name="fixedFee"
              type="number"
              min={0}
              step={100}
              defaultValue={platformCommission.fixedFee}
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2"
            />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-[var(--ink-700)]">Settlement rules / note</span>
            <input
              name="notes"
              defaultValue={platformCommission.notes}
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2"
              placeholder="Optional internal rule note"
            />
          </label>
          <div className="flex items-end justify-end md:col-span-4">
            <button type="submit" className="rounded-full bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]">
              Save platform commission
            </button>
          </div>
        </form>
      </Card>

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
            {company.recentTransactions.length ? company.recentTransactions.map((transaction) => (
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
            )) : (
              <div className="px-6 py-8 text-sm text-[var(--ink-500)]">No recent transactions are available.</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5"><h2 className="text-lg font-semibold text-[var(--ink-950)]">Recent payment requests</h2></div>
          <div className="divide-y divide-[var(--line)]">
            {company.recentPaymentRequests.length ? company.recentPaymentRequests.map((item) => (
              <div key={item.id} className="px-6 py-4 text-sm">
                <div className="font-semibold text-[var(--ink-950)]">{item.title}</div>
                <div className="mt-1 text-[var(--ink-600)]">{item.amount}</div>
                <div className="mt-1 text-[var(--ink-500)]">{item.status}  -  Due {item.dueAt}</div>
              </div>
            )) : (
              <div className="px-6 py-8 text-sm text-[var(--ink-500)]">No payment requests are available.</div>
            )}
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
            {!company.providerAccounts.length && !company.subscriptions.length ? (
              <div className="px-6 py-8 text-sm text-[var(--ink-500)]">No provider accounts or subscriptions are configured.</div>
            ) : null}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5"><h2 className="text-lg font-semibold text-[var(--ink-950)]">Billing and payment timeline</h2></div>
          <div className="divide-y divide-[var(--line)]">
            {company.recentBilling.length ? company.recentBilling.map((item) => (
              <div key={item.id} className="px-6 py-4 text-sm">
                <div className="font-semibold text-[var(--ink-950)]">{item.type}</div>
                <div className="mt-1 text-[var(--ink-600)]">{item.summary}</div>
                <div className="mt-1 text-[var(--ink-500)]">{item.amount ?? "No amount"}  -  {item.createdAt}</div>
              </div>
            )) : (
              <div className="px-6 py-8 text-sm text-[var(--ink-500)]">No billing events are available.</div>
            )}
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
