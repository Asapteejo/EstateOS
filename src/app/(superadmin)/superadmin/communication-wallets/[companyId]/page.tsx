import Link from "next/link";
import { notFound } from "next/navigation";

import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { getCompanyWalletOverview } from "@/modules/communication/wallet";
import { adjustCommunicationWalletAction } from "@/app/(superadmin)/superadmin/communication-wallets/actions";

function balanceClassName(balance: number) {
  return balance < 0 ? "text-rose-700" : "text-emerald-700";
}

export default async function SuperadminCompanyWalletPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const { companyId } = await params;
  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const error = resolvedSearchParams.error;
  const adjusted = resolvedSearchParams.adjusted === "1";

  const company = featureFlags.hasDatabase
    ? await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      })
    : { id: companyId, name: "Demo company" };

  if (!company) {
    notFound();
  }

  const overview = await getCompanyWalletOverview(companyId, { take: 50 });
  const wallet = overview.wallet;

  return (
    <SuperadminShell
      title={`${company.name} wallet`}
      subtitle="Superadmin-only WhatsApp credit management. Manual adjustments do not affect Resend email or tenant payment collections."
      actions={
        <Link
          href="/superadmin/communication-wallets"
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]"
        >
          All wallets
        </Link>
      }
    >
      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card> : null}
      {adjusted ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Wallet adjusted successfully.</Card> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-[var(--ink-500)]">Credit Balance</div>
          <div className={`mt-2 text-3xl font-semibold ${balanceClassName(wallet.balance)}`}>{wallet.balance}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-[var(--ink-500)]">Currency</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{wallet.currency}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-[var(--ink-500)]">Low balance threshold</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{wallet.lowBalanceThreshold ?? "Not set"}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-[var(--ink-500)]">Blocked status</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{wallet.isBlocked ? "Blocked" : "Not blocked"}</div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[var(--ink-950)]">Adjust Credits</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-600)]">
          Add top-up credits or record a manual correction. Negative adjustments are allowed for corrections.
        </p>
        <form action={adjustCommunicationWalletAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
          <input type="hidden" name="companyId" value={companyId} />
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Amount</span>
            <input name="amount" type="number" step="1" required className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="100 or -25" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Type</span>
            <select name="type" defaultValue="TOP_UP" className="w-full rounded-xl border border-[var(--line)] px-3 py-2">
              <option value="TOP_UP">Top up</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Note / reference</span>
            <input name="reference" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Manual pilot credit, correction, etc." />
          </label>
          <button type="submit" className="rounded-full bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]">
            Save adjustment
          </button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Usage History</h2>
          <p className="mt-1 text-sm text-[var(--ink-500)]">Latest WhatsApp usage, top-ups, and manual adjustments.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--sand-100)] text-left text-[var(--ink-500)]">
              <tr>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Balance after</th>
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {overview.ledger.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 font-medium text-[var(--ink-950)]">{entry.type}</td>
                  <td className={`px-6 py-4 font-semibold ${entry.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</td>
                  <td className={`px-6 py-4 font-semibold ${balanceClassName(entry.balanceAfter)}`}>{entry.balanceAfter}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{entry.reference ?? "—"}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{formatDate(entry.createdAt, "PPP p")}</td>
                </tr>
              ))}
              {overview.ledger.length === 0 ? (
                <tr><td className="px-6 py-6 text-sm text-[var(--ink-500)]" colSpan={5}>No ledger entries yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </SuperadminShell>
  );
}
