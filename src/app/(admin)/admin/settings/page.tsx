import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DomainSettings } from "@/components/admin/domain-settings";
import { CommunicationWalletTopUp } from "@/components/admin/communication-wallet-top-up";
import { PaymentAccountSetup } from "@/components/admin/payment-account-setup";
import { SettingsManagement } from "@/components/admin/settings-management";
import { TenantReadinessChecklist } from "@/components/shared/tenant-readiness-checklist";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { buildCustomDomainDnsInstructions } from "@/lib/domains/custom-domain";
import { resolveCompanyPublicUrl } from "@/lib/domains/public-url";
import { env, featureFlags } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { getCompanyWalletOverview } from "@/modules/communication/wallet";
import { getTenantReadinessForCompany } from "@/modules/readiness/service";
import { getTenantAdminSettings } from "@/modules/settings/service";

export default async function AdminSettingsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const [settings, communicationWallet, readiness] = await Promise.all([
    getTenantAdminSettings(tenant),
    tenant.companyId
      ? getCompanyWalletOverview(tenant.companyId, { take: 5 })
      : Promise.resolve(null),
    tenant.companyId
      ? getTenantReadinessForCompany(tenant.companyId)
      : Promise.resolve(null),
  ]);
  const dnsInstructions = buildCustomDomainDnsInstructions({
    cnameTarget: env.CUSTOM_DOMAIN_CNAME_TARGET,
    rootTarget: env.CUSTOM_DOMAIN_ROOT_TARGET,
  });

  const subdomainUrl = resolveCompanyPublicUrl({
    slug: settings.slug,
    subdomain: settings.subdomain,
    customDomain: null, // always use subdomain URL here, custom domain shown separately
    customDomainStatus: null,
  });

  return (
    <DashboardShell
      area="admin"
      title="Settings"
      subtitle="Manage tenant branding, defaults, payment display rules, and public staff visibility without developer intervention."
    >
      {/* Domain card — top priority */}
      {readiness ? (
        <TenantReadinessChecklist
          title="Tenant readiness"
          description="Production launch checks for this company. Items show who owns the next action."
          items={readiness.checklist}
        />
      ) : null}

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">
            Site & domain
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
            Your public site address
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
            Your site is always reachable on your EstateOS subdomain. Add a custom domain to use
            your own branded address.
          </p>
        </div>
        <DomainSettings
          slug={settings.slug}
          subdomain={settings.subdomain}
          subdomainUrl={subdomainUrl}
          customDomain={settings.customDomain}
          customDomainStatus={settings.customDomainStatus}
          cnameTarget={dnsInstructions.cname.target}
          rootTarget={dnsInstructions.root.target}
        />
      </Card>

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">
              Branding workflow
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
              Use the branding studio for draft preview and publish
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
              Company identity settings stay here, but live theming now uses a separate draft and
              published workflow so public pages, the buyer portal, and admin surfaces stay safe
              and readable.
            </p>
          </div>
          <Link href="/admin/settings/branding">
            <Button variant="secondary">Open branding studio</Button>
          </Link>
          <Link href="/admin/settings/contracts">
            <Button variant="outline">Open contract settings</Button>
          </Link>
        </div>
      </Card>

      <SettingsManagement settings={settings} />

      {communicationWallet ? (
        <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">
                WhatsApp credits
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
                Communication wallet
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
                You have {communicationWallet.wallet.balance} WhatsApp credits remaining. Email
                notifications are included separately and do not use these credits.
              </p>
            </div>
            <div className={`rounded-2xl px-5 py-3 text-right ${communicationWallet.wallet.balance < 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.16em]">Credit Balance</div>
              <div className="mt-1 text-3xl font-semibold">{communicationWallet.wallet.balance}</div>
            </div>
          </div>
          <CommunicationWalletTopUp paystackConfigured={featureFlags.hasPaystack} />
          <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
            <div className="bg-[var(--sand-100)] px-4 py-3 text-sm font-semibold text-[var(--ink-700)]">
              Latest wallet entries
            </div>
            <div className="divide-y divide-[var(--line)]">
              {communicationWallet.ledger.slice(0, 5).map((entry) => (
                <div key={entry.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_0.6fr_0.6fr_1fr]">
                  <div className="font-medium text-[var(--ink-950)]">{entry.type}</div>
                  <div className={entry.amount < 0 ? "text-rose-700" : "text-emerald-700"}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</div>
                  <div className={entry.balanceAfter < 0 ? "text-rose-700" : "text-[var(--ink-700)]"}>{entry.balanceAfter}</div>
                  <div className="text-[var(--ink-500)]">{formatDate(entry.createdAt, "PPP p")}</div>
                </div>
              ))}
              {communicationWallet.ledger.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[var(--ink-500)]">
                  No WhatsApp usage or wallet adjustments yet.
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">
            Payments
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">Payment account</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
            Connect your Paystack subaccount so buyers can complete checkout and funds settle
            directly to your bank.
          </p>
        </div>
        <PaymentAccountSetup />
      </Card>
    </DashboardShell>
  );
}
