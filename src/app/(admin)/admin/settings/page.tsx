import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { SettingsManagement } from "@/components/admin/settings-management";
import { PaymentAccountSetup } from "@/components/admin/payment-account-setup";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getTenantAdminSettings } from "@/modules/settings/service";

export default async function AdminSettingsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const settings = await getTenantAdminSettings(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Settings"
      subtitle="Manage tenant branding, defaults, payment display rules, and public staff visibility without developer intervention."
    >
      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">Branding workflow</div>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">Use the branding studio for draft preview and publish</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
              Company identity settings stay here, but live theming now uses a separate draft and published workflow so public pages, the buyer portal, and admin surfaces stay safe and readable.
            </p>
          </div>
          <Link href="/admin/settings/branding">
            <Button variant="secondary">Open branding studio</Button>
          </Link>
        </div>
      </Card>
      <SettingsManagement settings={settings} />

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">Payments</div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">Payment account</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
            Connect your Paystack subaccount so buyers can complete checkout and funds settle directly to your bank.
          </p>
        </div>
        <PaymentAccountSetup />
      </Card>
    </DashboardShell>
  );
}
