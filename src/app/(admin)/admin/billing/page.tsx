import { DashboardShell } from "@/components/portal/dashboard-shell";
import { BillingManagement } from "@/components/admin/billing-management";
import { requireAdminSession } from "@/lib/auth/guards";
import { getBillingDashboardData } from "@/modules/billing/service";

export default async function AdminBillingPage() {
  const tenant = await requireAdminSession();
  const billing = await getBillingDashboardData(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Billing & Monetization"
      subtitle="Plans, grants, commission behavior, payout readiness, and platform revenue visibility."
    >
      <BillingManagement
        isSuperAdmin={tenant.isSuperAdmin}
        companyPlanStatus={billing.companyPlanStatus}
        companyBilling={billing.companyBilling}
        companySummary={billing.companySummary}
        plans={billing.plans}
        companies={billing.companies}
      />
    </DashboardShell>
  );
}
