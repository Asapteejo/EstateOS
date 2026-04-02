import Link from "next/link";

import { DashboardShell } from "@/components/portal/dashboard-shell";
import { PaymentRequestManagement } from "@/components/admin/payment-request-management";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminPaymentMonitoring } from "@/modules/admin/control-center";

export default async function AdminPaymentsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const monitoring = await getAdminPaymentMonitoring(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Payments Monitoring"
      subtitle="Outstanding balances, overdue deals, receipt access, and the deals that still need collection work."
    >
      <div className="flex justify-end">
        <a href="/api/admin/exports/payments">
          <Button variant="outline">Export payments CSV</Button>
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {monitoring.summary.map(([label, value]) => (
          <Card key={label} className="rounded-[28px] border-[var(--line)] bg-white p-5">
            <div className="text-sm text-[var(--ink-500)]">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">Deal payment register</h3>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--sand-100)] text-[var(--ink-500)]">
              <tr>
                {["Reference", "Buyer", "Payment state", "Stage", "Outstanding", "Next due", "Receipt"].map((column) => (
                  <th key={column} className="px-6 py-3 font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monitoring.rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)]">
                  <td className="px-6 py-4 text-[var(--ink-700)]">{row.reference}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{row.buyer}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{row.paymentStatus}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{row.stage}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{row.outstandingBalance}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">{row.nextDueAt}</td>
                  <td className="px-6 py-4 text-[var(--ink-700)]">
                    {row.receiptId ? (
                      <Link href={`/api/receipts/${row.receiptId}/download`} className="text-[var(--brand-700)] underline">
                        Download
                      </Link>
                    ) : (
                      "Pending"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PaymentRequestManagement
        clients={monitoring.clientOptions}
        requests={monitoring.paymentRequests}
      />
    </DashboardShell>
  );
}
