import Link from "next/link";

import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getSuperadminControlsData } from "@/modules/superadmin/queries";

export default async function SuperadminSettingsPage() {
  await requireSuperAdminSession();
  const controls = await getSuperadminControlsData();

  return (
    <SuperadminShell
      title="Platform controls and guardrails"
      subtitle="See what is configurable, what is misconfigured, and where the platform needs operator attention."
    >
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Missing payout setup</div>
          <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{controls.controls.missingPayoutSetup}</div>
          <div className="mt-2 text-sm text-rose-700">Companies blocked from clean split settlement execution</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Inactive companies</div>
          <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{controls.controls.inactiveCompanies}</div>
          <div className="mt-2 text-sm text-[var(--ink-600)]">Likely churn or dormant accounts needing intervention</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Collections risk companies</div>
          <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{controls.controls.collectionsRiskCompanies}</div>
          <div className="mt-2 text-sm text-rose-700">Tenants with overdue money or billing pressure right now</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Plans and monetization rules</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              EstateOS pricing surfaces that determine what the platform earns and how companies are charged.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {controls.plans.map((plan) => (
              <div key={plan.id} className="grid gap-3 px-6 py-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <div className="font-semibold text-[var(--ink-950)]">{plan.name} {plan.interval.toLowerCase()}</div>
                  <div className="mt-1 text-sm text-[var(--ink-500)]">{plan.isActive ? "Active plan" : "Inactive plan"}</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">{formatCurrency(plan.priceAmount, plan.currency)}</div>
                <div className="text-sm text-[var(--ink-500)]">{plan.subscriberCount} subscribers</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Companies needing intervention</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Start with payout readiness gaps and collections-heavy accounts.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {controls.companiesNeedingAttention.map((company) => (
              <div key={company.companyId} className="px-6 py-4 text-sm">
                <Link href={`/superadmin/companies/${company.companyId}`} className="font-semibold text-[var(--ink-950)] hover:underline">
                  {company.companyName}
                </Link>
                <div className="mt-1 text-[var(--ink-600)]">{company.providerReadinessLabel}</div>
                <div className="mt-1 text-[var(--ink-500)]">
                  Overdue {company.overdueFormatted}  -  EstateOS revenue {company.platformRevenueFormatted}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Webhook and reconciliation visibility</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Signature failures and reconciliation-adjacent issues that can threaten payment trust.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {controls.controls.recentWebhookIssues.length ? (
              controls.controls.recentWebhookIssues.map((item) => (
                <div key={item.id} className="px-6 py-4 text-sm">
                  <div className="font-semibold text-[var(--ink-950)]">{item.companyName}</div>
                  <div className="mt-1 text-[var(--ink-600)]">{item.provider}  -  {item.eventType}</div>
                  <div className="mt-1 text-[var(--ink-500)]">{item.createdAt}</div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-sm text-[var(--ink-500)]">No recent webhook verification issues.</div>
            )}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Automation and platform health</h2>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Background job issues that can affect collections reminders, verification sweeps, or operational trust.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {controls.controls.recentJobFailures.length ? (
              controls.controls.recentJobFailures.map((item) => (
                <div key={item.id} className="px-6 py-4 text-sm">
                  <div className="font-semibold text-[var(--ink-950)]">{item.companyName}</div>
                  <div className="mt-1 text-[var(--ink-600)]">{item.jobName}</div>
                  <div className="mt-1 text-[var(--ink-500)]">{item.error}</div>
                  <div className="mt-1 text-[var(--ink-500)]">{item.createdAt}</div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-sm text-[var(--ink-500)]">No recent background job failures.</div>
            )}
          </div>
        </Card>
      </div>
    </SuperadminShell>
  );
}
