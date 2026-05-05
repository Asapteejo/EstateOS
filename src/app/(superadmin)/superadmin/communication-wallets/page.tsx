import Link from "next/link";

import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";
import { listCompanyWalletSummaries } from "@/modules/communication/wallet";

function balanceClassName(balance: number) {
  return balance < 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700";
}

export default async function SuperadminCommunicationWalletsPage() {
  await requireSuperAdminSession();
  const wallets = await listCompanyWalletSummaries();

  return (
    <SuperadminShell
      title="Communication wallets"
      subtitle="Monitor WhatsApp credits across tenants. Manual top-ups and adjustments are superadmin-only until Paystack top-ups are introduced."
      actions={
        <Link
          href="/superadmin/companies"
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]"
        >
          Back to companies
        </Link>
      }
    >
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Tenant credit balances</h2>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            Email remains free/included. These balances only track WhatsApp credits.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--sand-100)] text-left text-[var(--ink-500)]">
              <tr>
                <th className="px-6 py-3 font-medium">Company</th>
                <th className="px-6 py-3 font-medium">Credit balance</th>
                <th className="px-6 py-3 font-medium">Total usage</th>
                <th className="px-6 py-3 font-medium">Last updated</th>
                <th className="px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {wallets.map((wallet) => (
                <tr key={wallet.companyId}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[var(--ink-950)]">{wallet.companyName}</div>
                    <div className="mt-1 text-xs text-[var(--ink-500)]">{wallet.companyId}</div>
                  </td>
                  <td className={`px-6 py-4 ${balanceClassName(wallet.balance)}`}>
                    {wallet.balance} {wallet.currency}
                  </td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{wallet.totalUsage} credits</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">
                    {wallet.lastUpdatedAt ? formatDate(wallet.lastUpdatedAt, "PPP p") : "Wallet not opened"}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/superadmin/communication-wallets/${wallet.companyId}`}
                      className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition hover:border-[var(--brand-500)] hover:text-[var(--ink-950)]"
                    >
                      View wallet
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </SuperadminShell>
  );
}
