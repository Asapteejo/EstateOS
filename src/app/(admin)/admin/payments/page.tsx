import { DashboardShell } from "@/components/portal/dashboard-shell";
import { StatCard } from "@/components/admin/admin-ui";
import { PaymentRequestManagement } from "@/components/admin/payment-request-management";
import { PaymentsRegisterTable } from "@/components/admin/payments-register-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { getAdminPaymentMonitoring } from "@/modules/admin/control-center";

export default async function AdminPaymentsPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/payments"));
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {monitoring.summary.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">Deal payment register</h3>
        </div>
        <PaymentsRegisterTable rows={monitoring.rows} />
      </Card>

      <PaymentRequestManagement
        clients={monitoring.clientOptions}
        requests={monitoring.paymentRequests}
      />
    </DashboardShell>
  );
}
